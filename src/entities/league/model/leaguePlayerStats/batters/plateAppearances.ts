import { countsAsAtBat, isHit } from '@/entities/league/model/leaguePlayerStats/otherSlices'
import type { AtBatOutcome } from '@/entities/league/model/leaguePlayerStats/otherSlices'
import { accumulateBatterLines } from '@/entities/league/model/leaguePlayerStats/batters/accumulateBatters'
import type { LeagueBatterLine } from '@/entities/league/model/leaguePlayerStats/types/batterLine'
import type { LeaguePlateAppearance } from '@/entities/league/model/leaguePlayerStats/types/events'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats/types/playerStats'

/** +0x24·+0x26 의 상한 — a8552·a8594 `0x270f` */
const EXTRA_BASE_HIT_LIMIT = 9999

/** 값이 있을 때만 그 칸을 둔다 — 옛 저장에 없던 칸은 없는 채로 남긴다 */
function optionalField<Key extends string>(key: Key, value: number | undefined): Partial<Record<Key, number>> {
  return value === undefined ? {} : ({ [key]: value } as Record<Key, number>)
}

/** 이 타석이 그 루타면 +1(9999 상한), 아니면 그대로 */
function extraBaseCountOf(current: number | undefined, isThisHit: boolean): number | undefined {
  return isThisHit ? Math.min(EXTRA_BASE_HIT_LIMIT, (current ?? 0) + 1) : current
}

const isHitOf = (outcome: AtBatOutcome, bases: number) => outcome.kind === '안타' && outcome.bases === bases

/** 타석 하나를 한 줄에 더한다 (0xa8024 의 네 칸). 타수는 볼넷을 빼고 센다 */
function addPlateAppearance(line: LeagueBatterLine, outcome: AtBatOutcome, runsBattedIn: number): LeagueBatterLine {
  return {
    atBats: line.atBats + (countsAsAtBat(outcome) ? 1 : 0),
    hits: line.hits + (isHit(outcome) ? 1 : 0),
    homeRuns: line.homeRuns + (outcome.kind === '홈런' ? 1 : 0),
    runsBattedIn: line.runsBattedIn + runsBattedIn,
    ...optionalField('steals', line.steals),
    // +0x2e 실책은 수비 그림이 쌓는다 (`recordLeagueErrors`) — 여기서는 그대로 둔다
    ...optionalField('errors', line.errors),
    // a8520~a85ac — 2루타 +0x24 · 3루타 +0x26 (9999 상한)
    ...optionalField('doubles', extraBaseCountOf(line.doubles, isHitOf(outcome, 2))),
    ...optionalField('triples', extraBaseCountOf(line.triples, isHitOf(outcome, 3))),
  }
}

/**
 * 타석 여러 개를 한 번에 쌓는다. 경기 하나(또는 하루치 다섯 경기)를 마친 뒤 한 번 부르면 된다 —
 * 원본은 타석마다 부르지만 결과는 같고, 불변 객체를 타석마다 새로 만들지 않아도 된다.
 */
export function recordLeaguePlateAppearances(stats: LeaguePlayerStats, plateAppearances: readonly LeaguePlateAppearance[]): LeaguePlayerStats {
  if (plateAppearances.length === 0) return stats
  return accumulateBatterLines(stats, plateAppearances, (line, appearance) => addPlateAppearance(line, appearance.outcome, appearance.runsBattedIn))
}
