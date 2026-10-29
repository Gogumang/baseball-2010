import { BATTERS_PER_TEAM, PITCHERS_PER_TEAM } from '@/entities/league/model/leaguePlayerStats/otherSlices'
import { EMPTY_LEAGUE_BATTER_LINE } from '@/entities/league/model/leaguePlayerStats/types/batterLine'
import type { LeagueBatterLine } from '@/entities/league/model/leaguePlayerStats/types/batterLine'
import { EMPTY_LEAGUE_PITCHER_LINE } from '@/entities/league/model/leaguePlayerStats/types/pitcherLine'
import type { LeaguePitcherLine } from '@/entities/league/model/leaguePlayerStats/types/pitcherLine'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats/types/playerStats'

/**
 * 타자 전역 번호 — `팀 × 12 + 로스터 칸` (`teamRoster.teamBatters` 가 자르는 칸 그대로).
 * 받는 값은 이미 로스터 칸(0~11)이다(`LeaguePlateAppearance.battingOrderIndex` 주석). `% 12` 는
 * 칸을 돌려 쓰려는 것이 아니라 범위 밖·음수 값이 들어와도 표 밖을 가리키지 않게 감싸는 것뿐이다.
 */
export function leagueBatterIdOf(teamId: number, battingOrderIndex: number): number {
  const slot = ((battingOrderIndex % BATTERS_PER_TEAM) + BATTERS_PER_TEAM) % BATTERS_PER_TEAM
  return teamId * BATTERS_PER_TEAM + slot
}

/** 그 선수의 이번 시즌 성적. 타석에 선 적이 없으면 0 줄이다 */
export function leagueBatterLineOf(stats: LeaguePlayerStats, batterId: number): LeagueBatterLine {
  return stats.batters[batterId] ?? EMPTY_LEAGUE_BATTER_LINE
}

/**
 * 투수 전역 번호 — `teamRoster.teamPitchers` 가 `PITCHERS.slice(팀 × 8, +8)` 로 자르는 칸 그대로다.
 * 섞인 레코드 차례(로테이션 0xb5ca8)와 상관없이 붙박이 표 칸으로 센다 — 기록은 레코드를 따라간다 (`League.pitcherOrders`).
 */
export function leaguePitcherIdOf(teamId: number, pitcherSlot: number): number {
  const slot = ((pitcherSlot % PITCHERS_PER_TEAM) + PITCHERS_PER_TEAM) % PITCHERS_PER_TEAM
  return teamId * PITCHERS_PER_TEAM + slot
}

/** 붙박이 표 밖 선수(영입한 명전·나리)의 이번 시즌 타자 줄 — 원본 id 로 (`recordBatters`) */
export function leagueRecordBatterLineOf(stats: LeaguePlayerStats, recordId: number): LeagueBatterLine {
  return stats.recordBatters?.[recordId] ?? EMPTY_LEAGUE_BATTER_LINE
}

/** 붙박이 표 밖 선수의 이번 시즌 투수 줄 — 원본 id 로 (`recordPitchers`) */
export function leagueRecordPitcherLineOf(stats: LeaguePlayerStats, recordId: number): LeaguePitcherLine {
  return stats.recordPitchers?.[recordId] ?? EMPTY_LEAGUE_PITCHER_LINE
}

/** 그 투수의 이번 시즌 성적. 한 번도 안 던졌으면(또는 옛 저장이면) 0 줄이다 */
export function leaguePitcherLineOf(stats: LeaguePlayerStats, pitcherId: number): LeaguePitcherLine {
  return stats.pitchers?.[pitcherId] ?? EMPTY_LEAGUE_PITCHER_LINE
}
