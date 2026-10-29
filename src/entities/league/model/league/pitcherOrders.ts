import { advanceRotation } from '@/entities/league/model/league/otherSlices'
import type { League } from '@/entities/league/model/league/standings'

/** 투수 레코드 칸 수 (`team+0x0c` 8명) */
const PITCHER_RECORD_COUNT = 8

/** 한 번도 섞이지 않은 차례 `[0..7]` */
export const UNSHUFFLED_PITCHER_ORDER: readonly number[] = Array.from({ length: PITCHER_RECORD_COUNT }, (_, slot) => slot)

/** 그 팀의 지금 투수 레코드 차례 (`League.pitcherOrders`) — 없으면 `[0..7]` */
export function pitcherOrderOf(league: Pick<League, 'pitcherOrders'>, team: number): readonly number[] {
  return league.pitcherOrders?.[team] ?? UNSHUFFLED_PITCHER_ORDER
}

/** 그 팀 레코드 0번 = 오늘의 선발 — 붙박이 표 칸 (`0xb891c` 의 `team[0] = 0`) */
export function leagueStarterSlotOf(league: Pick<League, 'pitcherOrders'>, team: number): number {
  return pitcherOrderOf(league, team)[0] ?? 0
}

/** 그 팀들의 레코드를 `0xb5ca8` 로 한 칸씩 돌린다 (투수 0~3 당기기, 영구) */
export function rotateLeaguePitchers(league: League, teams: readonly number[]): League {
  if (teams.length === 0) return league
  const pitcherOrders: Record<number, readonly number[]> = { ...league.pitcherOrders }
  for (const team of teams) pitcherOrders[team] = advanceRotation(pitcherOrders[team] ?? UNSHUFFLED_PITCHER_ORDER)
  return { ...league, pitcherOrders }
}
