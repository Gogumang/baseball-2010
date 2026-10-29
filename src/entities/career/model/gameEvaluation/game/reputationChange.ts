import { isCycle } from '@/entities/career/model/gameEvaluation/game/popularityChange'
import { EMPTY_REPUTATION_COUNTS, type GameEvaluationInput, type ReputationCounts } from '@/entities/career/model/gameEvaluation/game/types'
import type { SeasonStats } from '@/entities/career/model/seasonStats'

const HITLESS_REPUTATION = -5
const DOUBLE_PLAY_REPUTATION = -2
const SCORING_POSITION_OUT_REPUTATION = -1
const STRIKEOUT_REPUTATION = -2

/** 평판 구간 보정 — 가산 쪽 0xd82a0 (%) */
const REPUTATION_GAIN_TIERS = [90, 70, 50, 20, 10, 0, -5, -10, -15, -20]
/** 평판 구간 보정 — 감산 쪽 0xd82c8 (%) */
const REPUTATION_LOSS_TIERS = [-90, -70, -50, -30, -10, 0, 5, 10, 20, 30]

/** 인기도 변화 3→1 · 4→2 · 5→3 · 6→4 */
const fromPopularityOf = (popularityChange: number) => (popularityChange >= 3 ? popularityChange - 2 : 0)

/** 홈런수 1→2 · 2~3→3 · >3→4 */
function fromHomeRunsOf(homeRuns: number): number {
  if (homeRuns === 0) return 0
  if (homeRuns === 1) return 2
  return homeRuns <= 3 ? 3 : 4
}

/** 칸 하나씩 서 있으면 얹는 가산 — 만루홈런 2 · 사이클 3 · 볼넷>1 1 · 동점 2 · 역전 2 · 끝내기 3 · 번트안타 1 */
function eventGainOf(stats: SeasonStats, counts: ReputationCounts): number {
  const events: readonly (readonly [boolean, number])[] = [
    [counts.grandSlams > 0, 2],
    [isCycle(stats), 3],
    [counts.walks > 1, 1],
    [counts.tyingRuns > 0, 2],
    [counts.goAheadRuns > 0, 2],
    [counts.walkOffs > 0, 3],
    [counts.buntHits > 0, 1],
  ]
  return events.reduce((total, [on, points]) => total + (on ? points : 0), 0)
}

function gainOf(popularityChange: number, stats: SeasonStats, counts: ReputationCounts): number {
  const fromHits = stats.hits === 0 ? 0 : Math.min(stats.hits, 4)
  return fromPopularityOf(popularityChange) + fromHits + fromHomeRunsOf(stats.homeRuns) + eventGainOf(stats, counts)
}

/** 감산 m = (무안타 ? −5) + (병살>1 ? −2) + (삼진>1 ? −2) + (득점권아웃 ? −1) */
function lossOf(game: GameEvaluationInput): number {
  const { stats } = game
  const penalties: readonly (readonly [boolean, number])[] = [
    [stats.hits === 0, HITLESS_REPUTATION],
    [game.doublePlays > 1, DOUBLE_PLAY_REPUTATION],
    [stats.strikeouts > 1, STRIKEOUT_REPUTATION],
    [game.scoringPositionOuts > 0, SCORING_POSITION_OUT_REPUTATION],
  ]
  return penalties.reduce((total, [on, points]) => total + (on ? points : 0), 0)
}

/**
 * 평판 변화 (0xa6218, B-10 확정).
 *
 * ```
 * 가산 r7 = 인기도변화 3→1,4→2,5→3,6→4
 *         + 안타수 1→1,2→2,3→3,>3→4
 *         + 홈런수 1→2,2~3→3,>3→4
 *         + (만루홈런 ? 2) + (사이클 ? 3) + (볼넷>1 ? 1) + (동점득점 ? 2)
 *         + (역전득점 ? 2) + (끝내기 ? 3) + (번트안타 ? 1)
 * 감산 m  = (무안타 ? −5) + (병살>1 ? −2) + (삼진>1 ? −2) + (득점권아웃 ? −1)
 * i  = (평판 − 1) / 100                                  ; 0 쪽 버림
 * 변화 = (r7 + trunc(r7·T1[i]/100)) + (m − trunc(|m|·T2[i]/100))
 * ```
 *
 * 앞서 웹은 **구간 보정 T1/T2 가 통째로 빠져 있었고** 칸 7개(만루홈런·끝내기·번트안타·
 * 볼넷·역전·동점·삼진)도 없었다. 평판이 낮을수록 가산이 크게 부풀고(최대 +90%),
 * 높을수록 깎이는(−20%) 구조라 없으면 성장 곡선이 통째로 달라진다.
 */
export function reputationChangeOf(popularityChange: number, game: GameEvaluationInput, reputation: number): number {
  const gain = gainOf(popularityChange, game.stats, game.reputationCounts ?? EMPTY_REPUTATION_COUNTS)
  const loss = lossOf(game)
  const tier = Math.min(REPUTATION_GAIN_TIERS.length - 1, Math.max(0, Math.trunc((reputation - 1) / 100)))
  const adjustedGain = gain + Math.trunc((gain * REPUTATION_GAIN_TIERS[tier]) / 100)
  const adjustedLoss = loss - Math.trunc((Math.abs(loss) * REPUTATION_LOSS_TIERS[tier]) / 100)
  return adjustedGain + adjustedLoss
}
