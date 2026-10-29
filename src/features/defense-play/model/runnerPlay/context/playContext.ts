import type { DefenseContext } from '@/entities/fielding/model/fieldingState'
import { runCoverTick, runnerPlayBallInput } from '@/features/defense-play/model/coverTick'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { runnerStates } from '@/features/defense-play/model/runnerPlay/runners/playRunners'

export function contextAt(g: RunnerPlayFrame, tick: number): DefenseContext {
  return {
    play: g.play,
    fielders: g.fielders,
    runners: runnerStates(g),
    currentTick: tick,
    landingTick: g.input.chase?.trajectory.landingTick ?? 0,
  }
}

/** 플레이 vt30 = 0xb1c90 한 번 (`coverTick.runCoverTick`) — vt4c 끝 b4c72(매 틱) · 송구 꼬리 b3094 */
export function coverTick(g: RunnerPlayFrame, tick: number): void {
  const covered = runCoverTick({
    context: contextAt(g, tick),
    ...runnerPlayBallInput(g.ballPath, g.placedBallPoint, tick),
    relayFlag: g.relayFlag,
  })
  g.play = covered.play
  g.fielders = covered.fielders
  g.relayFlag = covered.relayFlag
}
