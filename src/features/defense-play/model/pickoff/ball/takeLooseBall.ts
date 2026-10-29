import { AI_STATE, type FielderState } from '@/entities/fielding/model/fieldingState'
import type { LooseBallChase } from '@/features/defense-play/model/looseBallChase'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'

/**
 * 새로 깐 공을 쫓게 한다 — 고르기 0xb3b38: AI 1 · 0xc 인 야수는 AI 0 으로, 고른 야수(+0x130)는 AI 1(목표는 AI 고리 b4aca 몫).
 * 공은 아무도 안 쥔다(b2f80 · b3070 · 0xb3148).
 */
export function takeLooseBall(g: PickoffFrame, next: LooseBallChase): void {
  g.chase = next
  g.ballBody = next.body
  g.ballPath = { trajectory: next.trajectory, startTick: next.startTick }
  g.fielders = g.fielders.map((fielder) => fielderAfterChoice(fielder, next.slot))
  // b3f5c — 백업 갈래(`CatchForecast.backupSlot`, r180): 머리 b3b7a 가 AI 1 · 0xc 를 0 으로 내린 뒤 고른다
  const backupSlot = next.backupSlot ?? -1
  if (backupSlot >= 0) {
    g.fielders = g.fielders.map((fielder) => (fielder.slot === backupSlot ? { ...fielder, aiState: AI_STATE.BACKUP } : fielder))
  }
  g.play = {
    ...g.play,
    held: false,
    ballHolderSlot: next.slot,
    catchFielderSlot: next.slot,
    catchTick: next.catchTick,
    // 고르기 0xb3b38 — +0x16c 포구 종류 · +0x176 동작 시작 틱 (b4134 가 본다, r176)
    catchKind: next.kind ?? g.play.catchKind,
    actionStartTick: next.actionStartTick ?? g.play.actionStartTick,
  }
}

/**
 * 고르기 뒤 야수 한 명 — 고른 야수는 b3e54 — AI 1 만 걸고 목표(+0x2c)는 안 적는다. 포구점은 AI 고리 b4aca 가 움직임 허용 +0x13c 를
 * 보고 적는다(r201 — 예전 웹은 여기서 바로 적어, 슬롯 2 뒤쪽 CPU 송구(526ae)를 받는 야수가 한 틱 일찍 걸었다). 머리 b3b7a — AI 1 · 0xc 는 AI 0
 */
function fielderAfterChoice(fielder: FielderState, chosenSlot: number): FielderState {
  if (fielder.slot === chosenSlot) return { ...fielder, aiState: AI_STATE.CHASE, holdingBall: false }
  if (fielder.aiState === AI_STATE.CHASE || fielder.aiState === AI_STATE.BACKUP) return { ...fielder, aiState: AI_STATE.IDLE, holdingBall: false }
  return fielder.holdingBall ? { ...fielder, holdingBall: false } : fielder
}
