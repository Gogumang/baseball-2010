import type { SeasonStats } from '@/entities/career/model/seasonStats'

const CYCLE_BONUS = 7

/** 사이클 — 단타 · 2루타 · 3루타 · 홈런이 모두 있다 */
export function isCycle(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}

/** 그 경기 삼진이 이만큼을 넘으면 −1 (0xa6934: `G+0x108 > 1`) */
const STRIKEOUT_PENALTY_LIMIT = 1

/** 경기 점수 → 인기도 변화 (0xa690c) — 위에서부터 처음 닿는 (최소 점수, 변화). 어느 것에도 못 닿으면 −2 */
const POPULARITY_CHANGE_BY_TOTAL: readonly (readonly [number, number])[] = [
  [11, 6],
  [8, 5],
  [6, 4],
  [4, 3],
  [3, 2],
  [1, 1],
  [0, 0],
  [-2, -1],
]
const LOWEST_POPULARITY_CHANGE = -2

/**
 * 경기 점수 → 인기도 변화 −2~6 (0xa690c): > 10 → 6 · ≥ 8 → 5 · ≥ 6 → 4 · ≥ 4 → 3 · 3 → 2 · ≥ 1 → 1 · 0 → 0 · ≥ −2 → −1 · 그 밖 −2
 * (점수는 정수라 "> 10" 은 "≥ 11" 과 같다).
 * 사이클 +7 **앞에** 삼진 2개 이상이면 −1 이 먼저 붙는다 (0xa6934) — 웹에 빠져 있던 줄이다.
 */
export function popularityChangeOf(points: number, stats: SeasonStats): number {
  const strikeoutPenalty = stats.strikeouts > STRIKEOUT_PENALTY_LIMIT ? -1 : 0
  const total = points + strikeoutPenalty + (isCycle(stats) ? CYCLE_BONUS : 0)
  return POPULARITY_CHANGE_BY_TOTAL.find(([minimum]) => total >= minimum)?.[1] ?? LOWEST_POPULARITY_CHANGE
}
