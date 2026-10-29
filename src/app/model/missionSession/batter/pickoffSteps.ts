import { applyPickoff, type MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { pickoffCallSoundIdOf, type PickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { playSoundIds } from '@/app/model/useSound'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { MISSION_OUTS_PER_INNING } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pickoffReplayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { withPitcherMissionRunnerResult } from '@/app/model/missionSession/runnerPlay/pitcherRunnerPlay'
import { resetAtBatWithConfirm, signalPitchSelection } from '@/app/model/missionSession/scene/sceneSteps'

/** 견제 판 끝의 판 손잡이 — 칸 · 타석 · 소리 */
export interface PickoffHands {
  readonly atoms: MissionAtoms
  readonly runner: AtBatRunner
  readonly audio: SoundPort
}

/**
 * 판정 콜 · 재생 칸 — 실시간으로 돈 판의 콜은 화면이 판 안의 그 틱(결과 메시지 0xbba → 0x51a56)에 이미 냈고, 재생 칸에 넣는 판은
 * 재생 화면이 기록된 틱(`tickSoundIds`)에 낸다
 */
function showPickoffResult({ atoms, audio }: PickoffHands, result: PickoffPlayResult, shownLive: boolean, callShown: boolean): void {
  const replayed = result.ticks.length > 0 && !shownLive
  if (!callShown && !replayed) playSoundIds(audio, [pickoffCallSoundIdOf(result)])
  if (replayed) atoms.set(pickoffReplayAtom, result)
}

/** 견제 판 끝 판정 B 0xae3e8 — 아웃 > 2 면 0x18(이 타석은 끊기고 다음은 새 타석 0xd → 0xe), 아니면 같은 타석 0xf(ae592) */
function continueAfterPickoff({ atoms, runner }: PickoffHands, interrupted: boolean): void {
  if (interrupted) resetAtBatWithConfirm(atoms, runner)
  else signalPitchSelection(atoms, 'same')
}

/**
 * 다 돈 CPU 견제 판을 타자 미션에 먹인다 — 진루 · 아웃 · 판정 콜 · 같은 타석 또는 끊긴 타석.
 * 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36). 원본은 결과 코드가 선 플레이 틱(메시지 0xbba)에
 * 낸다 — 실시간 판은 화면이 그 틱에 냈고(`callShown`), 화면이 결과를 못 넘긴 판만 여기서 낸다.
 * 공 도착 판의 3아웃(`handleMissionPitch`)과 같은 길 — 볼카운트는 새 타석 것, 남은 타석 · 스윙은 안 줄인다
 */
export function afterMissionCpuPickoff(
  hands: PickoffHands,
  current: MissionRun,
  result: PickoffPlayResult,
  shownLive: boolean,
  callShown = shownLive,
) {
  const interrupted = current.outs + result.advance.outsAdded >= MISSION_OUTS_PER_INNING
  hands.atoms.set(missionRunAtom, (previous) => (previous === null ? previous : applyPickoff(previous, result.advance, result.runnerFates)))
  showPickoffResult(hands, result, shownLive, callShown)
  continueAfterPickoff(hands, interrupted)
}

/**
 * 다 돈 사람 견제 판(투수 미션)을 먹인다 — 판정 B 0xae3e8 의 견제 가지는 아웃 ≤ 2 든 3아웃이든 정산 0xa8024 를 부른다(ae5a8).
 * 3아웃이면 이 타석은 끊긴다(아웃 > 2 → 0x18), 아니면 같은 타석 0xf(ae592). 판정 콜(세이프 17 · 견제사 62/20)은 판 안의 그 틱
 * (메시지 0xbba)이라 실시간 판은 화면이 냈다(`callShown`).
 */
export function afterPitcherMissionPickoff(
  hands: PickoffHands,
  run: PitcherRun,
  result: PickoffPlayResult,
  shownLive: boolean,
  callShown = shownLive,
) {
  const interrupted = run.outs + result.advance.outsAdded >= MISSION_OUTS_PER_INNING
  showPickoffResult(hands, result, shownLive, callShown)
  hands.atoms.set(pitcherRunAtom, withPitcherMissionRunnerResult(run, result, true))
  continueAfterPickoff(hands, interrupted)
}
