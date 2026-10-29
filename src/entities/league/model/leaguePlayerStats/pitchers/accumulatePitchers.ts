import { leaguePitcherIdOf } from '@/entities/league/model/leaguePlayerStats/lookup'
import { EMPTY_LEAGUE_PITCHER_LINE } from '@/entities/league/model/leaguePlayerStats/types/pitcherLine'
import type { LeaguePitcherLine } from '@/entities/league/model/leaguePlayerStats/types/pitcherLine'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats/types/playerStats'

/** 투수 줄 하나를 가리키는 사건 — 팀 · 투수 칸, 또는 붙박이 표 밖 선수 id */
interface PitcherEvent {
  readonly teamId: number
  readonly pitcherSlot: number
  readonly recordId?: number
}

/** 붙박이 칸을 가리지 않는다 */
export const ACCEPTS_ANY_SLOT = (_pitcherSlot: number): boolean => true

/**
 * 사건마다 그 투수의 줄을 고쳐 쌓는다 — 붙박이 표 밖 선수(id 있음)는 `recordPitchers`, 나머지는 투수 전역 번호로 `pitchers`.
 * `acceptsSlot` 이 거짓인 붙박이 칸은 건너뛴다. 표 밖 선수가 없으면 `recordPitchers` 칸을 만들지 않는다
 */
export function accumulatePitcherLines<Event extends PitcherEvent>(
  stats: LeaguePlayerStats,
  events: readonly Event[],
  add: (line: LeaguePitcherLine, event: Event) => LeaguePitcherLine,
  acceptsSlot: (pitcherSlot: number) => boolean,
): LeaguePlayerStats {
  const pitchers: Record<number, LeaguePitcherLine> = { ...stats.pitchers }
  let recordPitchers: Record<number, LeaguePitcherLine> | undefined
  for (const event of events) {
    if (event.recordId !== undefined) {
      recordPitchers ??= { ...stats.recordPitchers }
      recordPitchers[event.recordId] = add(recordPitchers[event.recordId] ?? EMPTY_LEAGUE_PITCHER_LINE, event)
      continue
    }
    if (!acceptsSlot(event.pitcherSlot)) continue
    const id = leaguePitcherIdOf(event.teamId, event.pitcherSlot)
    pitchers[id] = add(pitchers[id] ?? EMPTY_LEAGUE_PITCHER_LINE, event)
  }
  return recordPitchers === undefined ? { ...stats, pitchers } : { ...stats, pitchers, recordPitchers }
}
