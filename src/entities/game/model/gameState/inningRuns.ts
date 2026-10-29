import { PLAYER_SIDE_LAST_BAT, type GameState, type InningHalf } from '@/entities/game/model/gameState/types'

/** 0xb6a9c 의 `cmp #0x62; bgt` — 98 이하일 때만 칸을 올린다 */
const INNING_RUNS_RAISE_LIMIT = 0x62

/** 0xb6a9c 를 `runs` 번 — 칸이 98 이하일 때만 하나씩 올린다 */
function raisedInningCell(cell: number, runs: number): number {
  let raised = cell
  for (let run = 0; run < runs; run += 1) if (raised <= INNING_RUNS_RAISE_LIMIT) raised += 1
  return raised
}

/** 0xb6a9c 를 `runs` 번 — 측 `side` 의 지금 이닝 칸 (자동진행 중계 칸이 반 이닝 도중의 판을 그릴 때도 쓴다) */
export function withInningRuns(game: GameState, side: number, runs: number): GameState {
  if (runs <= 0) return game
  const board = game.inningRuns ?? { runs: [[], []] }
  const isHomeSide = side === 1
  const row = [...board.runs[isHomeSide ? 1 : 0]]
  const index = game.inning - 1
  const cell = raisedInningCell(row[index] ?? 0, runs)
  for (let fill = row.length; fill < index; fill += 1) row[fill] = 0
  row[index] = cell
  const next: readonly [readonly number[], readonly number[]] = isHomeSide ? [board.runs[0], row] : [row, board.runs[1]]
  return { ...game, inningRuns: { ...board, runs: next } }
}

/** 경기가 끝난 그 반 이닝의 공격 측을 남긴다 — 0x18 은 넘김을 안 한다 */
export function withFinalOffenseSide(game: GameState, side: 0 | 1): GameState {
  if (!game.isFinished) return game
  return { ...game, inningRuns: { runs: game.inningRuns?.runs ?? [[], []], finalOffenseSide: side } }
}

export const halfSideOf = (half: InningHalf): 0 | 1 => (half === '초' ? 0 : 1)

/**
 * 점수판 0x41c18 이 보는 판 값 — st[0x6b](0 부터 센 이닝) · st[9](공격 측) · 칸 st[0x6c..](이닝 mod 9) · 합 0xb69b0(98 상한 → 99).
 * 경기가 끝났으면 st[9] 는 끝난 반 이닝의 측이다.
 */
export function lineScoreSlotsOf(game: GameState): {
  readonly inning: number
  readonly offenseSide: 0 | 1
  readonly inningRuns: readonly [readonly number[], readonly number[]]
  readonly totals: readonly [number, number]
} {
  const inning = game.inning - 1
  const offenseSide = game.isFinished && game.inningRuns?.finalOffenseSide !== undefined ? game.inningRuns.finalOffenseSide : halfSideOf(game.half)
  const slotsOf = (side: 0 | 1) => {
    const slots = Array.from({ length: 9 }, () => 0)
    const row = game.inningRuns?.runs[side] ?? []
    for (let index = Math.max(0, inning - 8); index <= inning; index += 1) slots[index % 9] = row[index] ?? 0
    return slots
  }
  const away = game.playerSide === PLAYER_SIDE_LAST_BAT ? game.opponentScore : game.ourScore
  const home = game.playerSide === PLAYER_SIDE_LAST_BAT ? game.ourScore : game.opponentScore
  // 합 st[0x7e + s] 도 0xb6a9c 가 98 이하일 때만 올린다
  const capped = (score: number) => Math.min(score, INNING_RUNS_RAISE_LIMIT + 1)
  return { inning, offenseSide, inningRuns: [slotsOf(0), slotsOf(1)], totals: [capped(away), capped(home)] }
}
