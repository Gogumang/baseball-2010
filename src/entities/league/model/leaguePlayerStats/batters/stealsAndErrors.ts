import { accumulateBatterLines } from '@/entities/league/model/leaguePlayerStats/batters/accumulateBatters'
import type { LeagueBatterLine } from '@/entities/league/model/leaguePlayerStats/types/batterLine'
import type { LeagueFieldingError, LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats/types/events'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats/types/playerStats'

/** 0x43838~0x43852 · 0x438e4~0x43904 의 `0x270f` 상한 */
const ERROR_LIMIT = 9999

const addSteal = (line: LeagueBatterLine): LeagueBatterLine => ({ ...line, steals: (line.steals ?? 0) + 1 })

const addError = (line: LeagueBatterLine): LeagueBatterLine => ({
  ...line,
  errors: Math.min(ERROR_LIMIT, (line.errors ?? 0) + 1),
})

/** 도루를 +0x2c 에 쌓는다 (0xa8380 · 0xc1a98 — `strh` 라 s16, 실제로 넘칠 일은 없다) */
export function recordLeagueStolenBases(stats: LeaguePlayerStats, stolenBases: readonly LeagueStolenBase[]): LeaguePlayerStats {
  if (stolenBases.length === 0) return stats
  return accumulateBatterLines(stats, stolenBases, addSteal)
}

/** 실책을 +0x2e 에 쌓는다 (수비 그림 0x43278 4381a~43904 — `LeagueBatterLine.errors`). 게이트가 없다 */
export function recordLeagueErrors(stats: LeaguePlayerStats, errors: readonly LeagueFieldingError[]): LeaguePlayerStats {
  if (errors.length === 0) return stats
  return accumulateBatterLines(stats, errors, addError)
}
