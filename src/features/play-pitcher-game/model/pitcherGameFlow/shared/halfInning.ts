import type { GameState } from '@/entities/game/model/gameState'

/** 플레이 하나가 반 이닝을 넘겼는가 — 이닝 칸 · 삼자범퇴 표시 · 반 이닝 투구 수를 다시 세우는 자리 (0xa5b00) */
export function isHalfInningChanged(before: GameState, after: GameState): boolean {
  return after.half !== before.half || after.inning !== before.inning
}

/** 반 이닝이 넘어갔거나 경기가 끝났는가 — 판정 B 0xae3e8 의 아웃 > 2 · 경기 끝 갈래 */
export function isHalfInningOrGameEnded(before: GameState, after: GameState): boolean {
  return after.isFinished || isHalfInningChanged(before, after)
}
