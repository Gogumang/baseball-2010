import { isReadyToThrow } from '@/entities/fielding/model/fielderPose'
import { type DefenseContext, NONE } from '@/entities/fielding/model/fieldingState'
import { PITCHER_BALL_POINT, runCoverTick, runnerPlayBallInput } from '@/features/defense-play/model/coverTick'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { runnerStates } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'

export function contextAt(g: PickoffFrame, tick: number): DefenseContext {
  return {
    play: g.play,
    fielders: g.fielders,
    runners: runnerStates(g),
    currentTick: tick,
    // 공은 처음부터 쥐어져 있다 — 낙구 틱은 0 으로 둔다 (자동 진루의 "잡힐 뜬공" 갈래가 안 서게)
    landingTick: 0,
  }
}

/**
 * 플레이 vt30 = 0xb1c90 한 번 (`coverTick.runCoverTick`) — vt4c 끝 b4c72(매 틱) · 송구 꼬리 b3094. 견제 시작 0xb28be 는 부르지 않는다.
 * 0xb203a 의 자동 고리가 보는 +0x160 은 이 진행기의 `manualThrowBase` 다(`play.manualThrowBase` 는 다리라 비워 둔다 — 머리말)
 */
export function coverTick(g: PickoffFrame, tick: number): void {
  const context = contextAt(g, tick)
  const covered = runCoverTick({
    context: { ...context, play: { ...context.play, manualThrowBase: g.manualThrowBase } },
    ...runnerPlayBallInput(g.ballPath, PITCHER_BALL_POINT, tick),
    relayFlag: g.relayFlag,
  })
  g.play = { ...covered.play, manualThrowBase: NONE }
  g.fielders = covered.fielders
  g.relayFlag = covered.relayFlag
}

/** 공 가진 야수 vtC4 = 0xa20ec — 쥐었고 자세 워드 0 · 잠금 +0xb4 ≤ 0 · 준비 틱(+0xc8) ≤ 0 (r176 — 받는 포구의 워드도 막는다) */
export function isHolderReady(g: PickoffFrame): boolean {
  const holder = g.fielders[g.play.ballHolderSlot]
  return g.play.held && holder !== undefined && holder.holdingBall && isReadyToThrow(holder)
}
