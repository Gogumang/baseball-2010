import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { countsAsAtBat, isHit } from '@/entities/at-bat/model/atBatOutcome'

export interface SeasonStats {
  readonly games: number
  readonly plateAppearances: number
  readonly atBats: number
  readonly hits: number
  readonly doubles: number
  readonly triples: number
  readonly homeRuns: number
  readonly runsBattedIn: number
  readonly walks: number
  readonly strikeouts: number
}

export const EMPTY_SEASON_STATS: SeasonStats = {
  games: 0,
  plateAppearances: 0,
  atBats: 0,
  hits: 0,
  doubles: 0,
  triples: 0,
  homeRuns: 0,
  runsBattedIn: 0,
  walks: 0,
  strikeouts: 0,
}

export function recordAtBat(
  stats: SeasonStats,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): SeasonStats {
  return {
    ...stats,
    plateAppearances: stats.plateAppearances + 1,
    atBats: stats.atBats + (countsAsAtBat(outcome) ? 1 : 0),
    hits: stats.hits + (isHit(outcome) ? 1 : 0),
    doubles: stats.doubles + (outcome.kind === '안타' && outcome.bases === 2 ? 1 : 0),
    triples: stats.triples + (outcome.kind === '안타' && outcome.bases === 3 ? 1 : 0),
    homeRuns: stats.homeRuns + (outcome.kind === '홈런' ? 1 : 0),
    runsBattedIn: stats.runsBattedIn + runsBattedIn,
    walks: stats.walks + (outcome.kind === '볼넷' ? 1 : 0),
    strikeouts: stats.strikeouts + (outcome.kind === '삼진' ? 1 : 0),
  }
}

export function recordGamePlayed(stats: SeasonStats): SeasonStats {
  return { ...stats, games: stats.games + 1 }
}

export function mergeStats(left: SeasonStats, right: SeasonStats): SeasonStats {
  return {
    games: left.games + right.games,
    plateAppearances: left.plateAppearances + right.plateAppearances,
    atBats: left.atBats + right.atBats,
    hits: left.hits + right.hits,
    doubles: left.doubles + right.doubles,
    triples: left.triples + right.triples,
    homeRuns: left.homeRuns + right.homeRuns,
    runsBattedIn: left.runsBattedIn + right.runsBattedIn,
    walks: left.walks + right.walks,
    strikeouts: left.strikeouts + right.strikeouts,
  }
}

/** 타수가 0이면 타율은 존재하지 않는다. 0으로 내리면 '0할 타자'라는 거짓 정보가 된다. */
export function battingAverageOf(stats: SeasonStats): number | null {
  return stats.atBats === 0 ? null : stats.hits / stats.atBats
}

export function formatBattingAverage(average: number | null): string {
  return average === null ? '-.---' : average.toFixed(3).replace(/^0/, '')
}
