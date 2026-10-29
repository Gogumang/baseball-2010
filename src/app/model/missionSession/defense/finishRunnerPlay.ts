import { finishPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { isPickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import { runLiveRunnerPlayWithoutKeys, type LiveRunnerPlay } from '@/features/defense-play/model/liveRunnerPlay'
import type { RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { inPlayCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { playSoundIds } from '@/app/model/useSound'
import type { MissionScope } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { missionArrivalContextAtom, pendingRunnerPlayAtom, pitcherArrivalContextAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { missionSceneAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { afterMissionCpuPickoff, afterPitcherMissionPickoff } from '@/app/model/missionSession/batter/pickoffSteps'
import { continueMissionArrival, finishMissionArrivalAtBat } from '@/app/model/missionSession/batter/arrivalSteps'
import { finishPitcherMissionArrival } from '@/app/model/missionSession/pitcher/finishPitcherArrival'

type Hands = Pick<MissionScope, 'atoms' | 'runner' | 'random' | 'audio'>

/** 투수 미션 — 사람 수비의 송구 키(+0x160)를 받으며 돈 도루 · 폭투 · 견제 판 */
function finishDefenseSideRunnerPlay(hands: Hands, pending: LiveRunnerPlay, played: DefensePlayResult, callShown: boolean): void {
  const { atoms, audio } = hands
  const run = atoms.get(pitcherRunAtom)
  if (run === null) return
  if (pending.kind === 'pickoff') {
    if (isPickoffPlayResult(played)) afterPitcherMissionPickoff(hands, run, played, true, callShown)
    return
  }
  const context = atoms.get(pitcherArrivalContextAtom)
  atoms.set(pitcherArrivalContextAtom, null)
  if (context === null) return
  const play = finishPitchArrivalPlay(pending.opened, played as RunnerPlayEngineResult, true)
  if (!callShown) playSoundIds(audio, [play.callSoundId])
  finishPitcherMissionArrival(hands, run, play, context)
}

/** 타자 미션의 CPU 견제 판 끝 — 판이 남았고 견제 판 결과면 견제 뒤를 잇는다 */
function finishCpuPickoff(hands: Hands, played: DefensePlayResult, callShown: boolean): void {
  const current = hands.atoms.get(missionRunAtom)
  if (current === null || !isPickoffPlayResult(played)) return
  afterMissionCpuPickoff(hands, current, played, true, callShown)
}

/** 타자 미션 — 사람 주루 키를 받으며 돈 도루 · 폭투 · CPU 견제 판 */
function finishOffenseSideRunnerPlay(hands: Hands, pending: LiveRunnerPlay, played: DefensePlayResult, callShown: boolean): void {
  const { atoms, runner, audio } = hands
  runner.setIsPaused(false)
  if (pending.kind === 'pickoff') {
    finishCpuPickoff(hands, played, callShown)
    return
  }
  const context = atoms.get(missionArrivalContextAtom)
  atoms.set(missionArrivalContextAtom, null)
  if (context === null) return
  const play = finishPitchArrivalPlay(pending.opened, played as RunnerPlayEngineResult, true)
  // 판정 콜(도루 17 · 62/20, 폭투 17)은 판 안의 그 틱에 났다(화면이 결과를 못 넘긴 판만 여기서) · 타석이 끝났으면 그 콜
  playSoundIds(audio, [callShown ? null : play.callSoundId, context.outcome === null ? null : inPlayCallSoundIdOf(context.outcome)])
  if (continueMissionArrival(atoms, runner, play, context)) return
  if (context.outcome === null) return
  finishMissionArrivalAtBat(atoms, runner, play, { ...context, outcome: context.outcome })
}

/**
 * 수비 화면이 사람 주루 키를 받으며 붙든 주자 판(도루 · 폭투 · CPU 견제 — `pendingRunnerPlay`)을 다 돌렸다.
 * 결과를 못 받았으면 키 없이 끝까지 돌려서라도 붙든 상태를 푼다. 공 도착 판이면 그 공의 나머지를, 견제 판이면 견제 뒤를 잇는다.
 */
export function finishRunnerPlayOf(hands: Hands) {
  return (result?: DefensePlayResult) => {
    const { atoms } = hands
    const pending = atoms.get(pendingRunnerPlayAtom)
    if (pending === null) return
    const played = result ?? runLiveRunnerPlayWithoutKeys(pending)
    // 판이 남긴 수비 장면 칸은 다음 판으로 — 못 쓴 사람 송구 키(+0x160)는 다음 판 시작 vt1c 0xb0edc(b0f68)가 −1 로 지운다
    atoms.set(missionSceneAtom, played.scene)
    atoms.set(pendingRunnerPlayAtom, null)
    // 화면이 결과를 넘겼으면 판정 콜은 판 안의 그 틱(결과 메시지 0xbba → 0x51a56)에 이미 났다
    const callShown = result !== undefined
    if (pending.side === '수비') finishDefenseSideRunnerPlay(hands, pending, played, callShown)
    else finishOffenseSideRunnerPlay(hands, pending, played, callShown)
  }
}
