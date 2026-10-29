import { describeOutcomeBanner } from '@/entities/at-bat/model/resolutionText'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { applyOutcome as applyMissionOutcome, checkSwingsExhausted, recordSwing, type MissionRun } from '@/entities/mission/model/missionRun'
import { arrivalApplicationOf, type PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { atBatEndFramesOf, type AtBatRunner } from '@/app/model/useAtBatRunner'
import { MISSION_OUTS_PER_INNING } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pickoffReplayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import type { MissionArrivalContext } from '@/app/model/missionSession/types/missionPlayTypes'
import { withBatterNotOut, withMissionRunnerPlay } from '@/app/model/missionSession/runnerPlay/batterRunnerPlay'
import { enterNewAtBatConfirm, resetAtBatWithConfirm, signalPitchSelection } from '@/app/model/missionSession/scene/sceneSteps'

/** 판의 진루·아웃·득점을 먹인다 — 판에서 3아웃이면 이 타석의 스윙을 먼저 센다(그 뒤 반 이닝 넘김 · 자동진행이 타순을 옮긴다) */
function applyRunnerOnlyPlay(previous: MissionRun, play: PitchArrivalPlay, swingsFirst: boolean): MissionRun {
  return withMissionRunnerPlay(swingsFirst ? checkSwingsExhausted(recordSwing(previous)) : previous, play)
}

/**
 * 타자 미션 공 도착 판의 뒤 — 주자만 움직인 판(도루 · 삼진 없는 폭투)을 먹이고, 판에서 끊긴 타석 · 같은 타석 다음 공을 낸다.
 * 처리했으면 참(그 공은 끝났다). 실시간으로 보여 준 판(`play.shownLive`)은 재생 칸에 다시 안 넣는다.
 * 미리 돌린 판은 `handleMissionPitch` 가, 붙든 판은 판 끝(`actions.finishRunnerPlay`)이 부른다.
 */
export function continueMissionArrival(
  atoms: MissionAtoms,
  runner: AtBatRunner,
  play: PitchArrivalPlay | null,
  context: MissionArrivalContext,
): boolean {
  const { current, hasSwung, outcome } = context
  if (play !== null && arrivalApplicationOf(play) === 'runnerOnly') {
    // 판의 진루·아웃·득점을 먼저 먹이고 재생한다 — 타석은 이어진다(볼카운트 그대로)
    const interrupted = current.outs + play.result.advance.outsAdded >= MISSION_OUTS_PER_INNING
    atoms.set(missionRunAtom, (previous) => (previous === null ? previous : applyRunnerOnlyPlay(previous, play, interrupted && hasSwung)))
    if (play.result.ticks.length > 0 && play.shownLive !== true) atoms.set(pickoffReplayAtom, play.result)
    if (interrupted) {
      // 판에서 3아웃 — 이 타석은 끊긴다 (판정 B 0xae3e8 아웃 > 2 → 0x18 → 자동진행 → 0xd)
      resetAtBatWithConfirm(atoms, runner)
      return true
    }
  }
  if (outcome !== null) return false
  if (hasSwung) atoms.set(missionRunAtom, (previous) => (previous === null ? previous : checkSwingsExhausted(recordSwing(previous))))
  // 판정 A 0xae24c 의 "그 밖" — 같은 타석 다음 공(0xf)
  signalPitchSelection(atoms, 'same')
  return true
}

/** 끝난 타석 하나를 판에 먹인다 — 낫아웃이면 폭투·포일 판의 진루(타자주자 포함)가 이 삼진 타석의 진루다 (0x3e0d0 state[0x1a]) */
function settleArrivalAtBat(
  previous: MissionRun,
  play: PitchArrivalPlay | null,
  outcome: AtBatOutcome,
  hasSwung: boolean,
  isBunt: boolean,
): MissionRun {
  const swung = hasSwung ? recordSwing(previous) : previous
  if (play !== null && arrivalApplicationOf(play) === 'batterRuns') return withBatterNotOut(swung, outcome, isBunt, play)
  return applyMissionOutcome(swung, outcome, isBunt)
}

/** 타자 미션 공 도착 판 뒤 끝난 타석(볼넷 · 사구 · 삼진 · 낫아웃)을 먹인다 — 타구 판이 없는 타석 결과 */
export function finishMissionArrivalAtBat(
  atoms: MissionAtoms,
  runner: AtBatRunner,
  play: PitchArrivalPlay | null,
  context: Omit<MissionArrivalContext, 'current' | 'outcome'> & { readonly outcome: AtBatOutcome },
  /** 붙든 볼넷 · 사구를 판정 · 연출 끝에서 먹일 때 — 0x12 진입부터 이미 지난 그림 수(0xd 까지 남은 그림만 둔다, r298) */
  elapsedFrames = 0,
): void {
  const { hasSwung, outcome, isBunt, runnersOnBase } = context
  // 볼넷 · 사구 — 판정 A 0xae24c 가 밀어내기 판(종류 2, 0x17)으로 보낸다. 진루는 보통 길과 같아 판은 재생만 한다
  if (play !== null && arrivalApplicationOf(play) === 'freePass' && play.result.ticks.length > 0) atoms.set(pickoffReplayAtom, play.result)
  atoms.set(missionRunAtom, (previous) => (previous === null ? previous : settleArrivalAtBat(previous, play, outcome, hasSwung, isBunt)))
  // 결과 연출 뒤 새 타석 — 0xd → 0xe
  enterNewAtBatConfirm(atoms)
  // 0x12 진입에서 끝난 타석 — 도루 · 폭투 판(종류 5 · 9)이 열렸으면 곧장 0x17 이라 판 끝에서, 아니면 0x12 대기 32 그림 뒤 0xd
  runner.pauseWithBanner(describeOutcomeBanner(outcome, runnersOnBase), Math.max(0, atBatEndFramesOf(outcome, play) - elapsedFrames))
}
