import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { applyPitcherOutcome, checkPitchExhausted, type PitcherRun } from '@/entities/mission/model/pitcherRun'
import { arrivalApplicationOf, type PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { holdsUntilResultWaitEnd } from '@/features/play-game/model/benchClearingScene'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { MISSION_OUTS_PER_INNING } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pendingBenchClearingAtom, pickoffReplayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import type { PitcherArrivalContext } from '@/app/model/missionSession/types/missionPlayTypes'
import { withPitcherMissionRunnerPlay, withPitcherNotOut } from '@/app/model/missionSession/runnerPlay/pitcherRunnerPlay'
import { resetAtBatWithConfirm, signalPitchSelection } from '@/app/model/missionSession/scene/sceneSteps'

/** 투수 미션 공 도착 판 뒤의 손잡이 — 칸 · 타석 · 난수 */
export interface PitcherArrivalHands {
  readonly atoms: MissionAtoms
  readonly runner: AtBatRunner
  readonly random: RandomPort
}

/** 판이 어떻게 먹히는가 — 판이 없으면 null */
const appliedAs = (play: PitchArrivalPlay | null) => (play === null ? null : arrivalApplicationOf(play))

/** 끝난 타석의 정산 — 낫아웃이면 폭투·포일 판의 진루(타자주자 포함)가 이 삼진 타석의 진루다 (0x3e0d0 state[0x1a]) */
function settledAtBatOf(run: PitcherRun, play: PitchArrivalPlay | null, outcome: AtBatOutcome, random: RandomPort): PitcherRun {
  if (play !== null && appliedAs(play) === 'batterRuns') return withPitcherNotOut(run, outcome, play)
  return applyPitcherOutcome(run, outcome, {
    random,
    // 삼진과 한 정산인 도루 · 폭투·포일 판 — R+0x130 은 그 판의 주자 목록대로다 (a8c5c)
    ...(play !== null && outcome.kind === '삼진' && appliedAs(play) === 'runnerOnly' ? { settledRunnerFates: play.result.runnerFates } : {}),
  })
}

/**
 * 볼넷 · 사구 · 판 없는 삼진 — 공 도착 0x3dfac 은 0x12 를 예약할 뿐이다. 벤치 클리어링 굴림(4e74c, 사구만)·판정 A 의
 * 밀어내기 · 정산(삼진은 0xd · 0x18 과 0xa8024 — 판정 0xaaa6c 도 그 뒤 ae384)은 0x12 의 32 그림 뒤라 그동안 붙든다(그 그림들의
 * 입자 굴림이 먼저 난다 — 화면이 `judgeHitByPitch` 를 부른다, A-22 · r295 · r298). 붙들면 참
 */
function holdAtBatResult(atoms: MissionAtoms, run: PitcherRun, play: PitchArrivalPlay | null, context: PitcherArrivalContext, outcome: AtBatOutcome) {
  if (!holdsUntilResultWaitEnd(outcome, play)) return false
  atoms.set(pendingBenchClearingAtom, {
    side: '투수',
    phase: 'wait',
    run,
    pitcherStamina: context.pitcherStamina,
    outcome,
    walkReplay: play !== null && appliedAs(play) === 'freePass' ? play.result : null,
  })
  atoms.set(pitcherRunAtom, run)
  return true
}

/** 끝난 타석(볼넷 · 사구 · 삼진 · 낫아웃)을 먹이고 새 타석 — 붙들 결과면 판을 남기고 거짓 */
function finishAtBat(
  hands: PitcherArrivalHands,
  run: PitcherRun,
  play: PitchArrivalPlay | null,
  context: PitcherArrivalContext,
  outcome: AtBatOutcome,
) {
  const { atoms, runner, random } = hands
  if (holdAtBatResult(atoms, run, play, context, outcome)) return null
  // 도루 출발 중 볼넷 · 사구(A-24 — 3e0e4 → 3e114 가 곧장 0x17) — 밀어내기 판(종류 2)을 대기 없이 재생한다. 진루는 아래 보통 길과 같다
  if (play !== null && appliedAs(play) === 'freePass' && play.result.ticks.length > 0) atoms.set(pickoffReplayAtom, play.result)
  const settled = settledAtBatOf(run, play, outcome, random)
  resetAtBatWithConfirm(atoms, runner)
  return settled
}

/**
 * 주자만 움직인 판(도루 · 삼진 없는 폭투)의 진루·아웃·실점을 먼저 먹이고 재생한다 — 타석은 이어진다(볼카운트 그대로).
 * 판에서 3아웃이면 이 타석은 끊기고(판정 B 0xae3e8 아웃 > 2 → 0x18) null — 판까지 다 먹였다
 */
function applyRunnerOnlyPlay({ atoms, runner }: PitcherArrivalHands, run: PitcherRun, play: PitchArrivalPlay | null): PitcherRun | null {
  if (play === null || appliedAs(play) !== 'runnerOnly') return run
  const interrupted = run.outs + play.result.advance.outsAdded >= MISSION_OUTS_PER_INNING
  const nextRun = withPitcherMissionRunnerPlay(run, play)
  if (play.result.ticks.length > 0 && play.shownLive !== true) atoms.set(pickoffReplayAtom, play.result)
  if (!interrupted) return nextRun
  resetAtBatWithConfirm(atoms, runner)
  atoms.set(pitcherRunAtom, checkPitchExhausted(nextRun))
  return null
}

/**
 * 투수 미션 공 하나의 **공 도착 판 뒤** — 주자만 움직인 판(도루 · 삼진 없는 폭투)을 먹이고, 끝난 타석(볼넷 · 사구 · 삼진 · 낫아웃)
 * 이나 같은 타석 다음 공을 낸다. 미리 돌린 판(밀어내기 · 판 없음)은 `handleThrow` 가, 붙든 도루 · 폭투 판은 판 끝
 * (`actions.finishRunnerPlay`)이 부른다. 실시간으로 보여 준 판(`play.shownLive`)은 재생 칸에 다시 안 넣는다.
 */
export function finishPitcherMissionArrival(
  hands: PitcherArrivalHands,
  run: PitcherRun,
  play: PitchArrivalPlay | null,
  context: PitcherArrivalContext,
  /** 같은 타석 다음 공의 0xf 진입까지 남은 장면 틱 — 공을 놓은 걸음이면 0x12 를 다 선 뒤다(`signalPitchSelection`). 판 끝이면 0 */
  pitchSelectionDelayTicks = 0,
): void {
  const { atoms } = hands
  const nextRun = applyRunnerOnlyPlay(hands, run, play)
  if (nextRun === null) return
  if (context.outcome === null) {
    // 판정 A 의 "그 밖" — 같은 타석 다음 공(0xf)
    signalPitchSelection(atoms, 'same', pitchSelectionDelayTicks)
    atoms.set(pitcherRunAtom, checkPitchExhausted(nextRun))
    return
  }
  const settled = finishAtBat(hands, nextRun, play, context, context.outcome)
  if (settled !== null) atoms.set(pitcherRunAtom, settled)
}
