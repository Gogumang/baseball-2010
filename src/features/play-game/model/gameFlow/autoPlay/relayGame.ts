import type { GameState } from '@/entities/game/model/gameState'

/** 3아웃을 낸 타석 틱은 넘김 전 반 이닝으로 그린다 — 경기가 끝났으면 넘김이 없다 */
export function drawnRelayGameOf(after: GameState, before: GameState): GameState {
  if (after.isFinished || (after.inning === before.inning && after.half === before.half)) return after
  return { ...after, inning: before.inning, half: before.half, outs: 3 }
}
