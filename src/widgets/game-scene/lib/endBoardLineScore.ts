import { lineScoreSlotsOf, type GameState } from '@/entities/game/model/gameState'

/** 이닝별 점수판 0x41c18 의 판 값 — 경기 끝 판이 맨 끝(503d8)에 (14, 252) 로 부른다 */
export interface GameEndLineScore {
  /** 경기[0x28 + 칸] 두 측 팀 — 작은 로고 team_logo_ini */
  readonly sideTeams: readonly [number, number]
  /** st[0x6b] · st[9] */
  readonly inning: number
  readonly offenseSide: 0 | 1
  /** st[0x6c..] 측마다 아홉 칸 */
  readonly inningRuns: readonly [readonly number[], readonly number[]]
}

/** 경기 상태에서 경기 끝 판의 이닝별 점수판 값을 만든다 (`gameState.lineScoreSlotsOf` — 합은 판이 두 점수에서 읽는다) */
export function endBoardLineScoreOf(game: GameState, sideTeams: readonly [number, number]): GameEndLineScore {
  const slots = lineScoreSlotsOf(game)
  return { sideTeams, inning: slots.inning, offenseSide: slots.offenseSide, inningRuns: slots.inningRuns }
}
