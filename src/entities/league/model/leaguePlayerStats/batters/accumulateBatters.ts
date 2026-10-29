import { leagueBatterIdOf } from '@/entities/league/model/leaguePlayerStats/lookup'
import { EMPTY_LEAGUE_BATTER_LINE } from '@/entities/league/model/leaguePlayerStats/types/batterLine'
import type { LeagueBatterLine } from '@/entities/league/model/leaguePlayerStats/types/batterLine'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats/types/playerStats'

/** 타자 줄 하나를 가리키는 사건 — 팀 · 로스터 칸, 또는 붙박이 표 밖 선수 id */
interface BatterEvent {
  readonly teamId: number
  readonly battingOrderIndex: number
  readonly recordId?: number
}

/**
 * 사건마다 그 선수의 타자 줄을 고쳐 쌓는다 — 붙박이 표 밖 선수(id 있음)는 `recordBatters`, 나머지는 타자 전역 번호로 `batters`.
 * 표 밖 선수가 없으면 `recordBatters` 칸을 만들지 않는다 — 예전 저장과 같은 모양
 */
export function accumulateBatterLines<Event extends BatterEvent>(
  stats: LeaguePlayerStats,
  events: readonly Event[],
  add: (line: LeagueBatterLine, event: Event) => LeagueBatterLine,
): LeaguePlayerStats {
  const batters: Record<number, LeagueBatterLine> = { ...stats.batters }
  let recordBatters: Record<number, LeagueBatterLine> | undefined
  for (const event of events) {
    if (event.recordId !== undefined) {
      recordBatters ??= { ...stats.recordBatters }
      recordBatters[event.recordId] = add(recordBatters[event.recordId] ?? EMPTY_LEAGUE_BATTER_LINE, event)
      continue
    }
    const id = leagueBatterIdOf(event.teamId, event.battingOrderIndex)
    batters[id] = add(batters[id] ?? EMPTY_LEAGUE_BATTER_LINE, event)
  }
  return recordBatters === undefined ? { ...stats, batters } : { ...stats, batters, recordBatters }
}
