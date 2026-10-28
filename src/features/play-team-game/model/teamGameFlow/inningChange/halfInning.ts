import type { GameState } from '@/entities/game/model/gameState'

/** 반 이닝 표시 — 경기 상태 · `lastHumanHalf` · 반 이닝 투구 수 칸이 모두 이 두 칸을 든다 */
export type HalfInningMark = Pick<GameState, 'inning' | 'half'>

/** 같은 반 이닝인가 (이닝 · 초말이 둘 다 같다) */
export function isSameHalfInning(a: HalfInningMark, b: HalfInningMark): boolean {
  return a.inning === b.inning && a.half === b.half
}

/** 플레이 뒤 이 타석이 끊겼는가 — 경기가 끝났거나 반 이닝이 넘어갔다 (판정 B 0xae3e8: 아웃 > 2 → 0x18) */
export function isAtBatInterrupted(before: GameState, after: GameState): boolean {
  return after.isFinished || !isSameHalfInning(before, after)
}
