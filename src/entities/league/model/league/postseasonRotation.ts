import { advanceRotation } from '@/entities/league/model/league/otherSlices'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league/pitcherOrders'
import type { PostseasonSeries } from '@/entities/league/model/league/postseasonTypes'
import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league/schedule'

/**
 * 정규시즌 날 수 — 일정표 0xd89cb 9일 × 5 = 45일 (`SEASON_GAME_COUNT` 와 같은 값).
 * g = 0..44 중 g ≠ 0 인 44일에 팀마다 로테이션이 한 칸 돈다 → 포스트시즌은 44 칸 돈 레코드로 시작한다(44 % 4 = 0).
 */
const REGULAR_SEASON_DAYS = 45

/** 로테이션 칸 수 (0xb5ca8 — 투수 0~3) */
const POSTSEASON_ROTATION_SIZE = 4

/**
 * 포스트시즌 경기의 **그 팀 선발 칸** — 정규시즌이 끝났을 때의 레코드 차례(`baseOrders`) + 앞 시리즈에서 이어 온 칸 +
 * 이 시리즈 g 칸을 돈 레코드의 0번. 차례가 없으면(옛 저장·`startPostseason` 에 안 넘긴 길) 정규 44 칸을 돈 `[0..7]` 로 본다
 * — 그때는 지난 시즌에서 이어진 섞임·투수편 맞바꿈(0xa4f60)이 빠진다.
 */
export function postseasonStarterSlotOf(series: PostseasonSeries, team: number): number {
  return postseasonPitcherOrderOf(series, team)[0] ?? 0
}

/** 이번 포스트시즌 경기를 준비했을 때 그 팀의 투수 레코드 차례 전체 — 0번이 선발, 나머지가 벤치 차례다 */
export function postseasonPitcherOrderOf(series: PostseasonSeries, team: number): readonly number[] {
  const base = series.baseOrders?.[team]
  if (base === undefined) return rotatedBy(UNSHUFFLED_PITCHER_ORDER, postseasonRotationTurnsOf(series, team))
  return rotatedBy(base, (series.rotations?.[team] ?? 0) + postseasonGameOf(series))
}

function rotatedBy(order: readonly number[], turns: number): readonly number[] {
  let rotated = order
  for (let turn = 0; turn < turns % POSTSEASON_ROTATION_SIZE; turn += 1) rotated = advanceRotation(rotated)
  return rotated
}

/**
 * 포스트시즌이 다 끝났을 때 팀마다의 투수 레코드 차례 — 정규시즌 끝 차례(`baseOrders`, 없으면 44 칸 돈 `[0..7]`)에
 * 끝난 시리즈들에서 돈 칸(`rotations`)을 얹는다. 새 시즌으로 이어지는 값이다 (`nextSeasonLeague`).
 */
export function pitcherOrdersAfterPostseason(
  series: PostseasonSeries,
  regularSeasonOrders?: Readonly<Record<number, readonly number[]>>,
): Readonly<Record<number, readonly number[]>> {
  const orders: Record<number, readonly number[]> = {}
  for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) {
    const base = series.baseOrders?.[team] ?? regularSeasonOrders?.[team] ?? rotatedBy(UNSHUFFLED_PITCHER_ORDER, REGULAR_SEASON_DAYS - 1)
    orders[team] = rotatedBy(base, series.rotations?.[team] ?? 0)
  }
  return orders
}

/** 이번 포스트시즌 경기를 준비할 때까지 그 팀 레코드가 돈 로테이션 수 — 정규 44 + 앞 시리즈 이월 + 이 시리즈 g */
export function postseasonRotationTurnsOf(series: PostseasonSeries, team: number): number {
  return REGULAR_SEASON_DAYS - 1 + (series.rotations?.[team] ?? 0) + postseasonGameOf(series)
}

/**
 * 포스트시즌 날짜 카운터 g = `L+0x32` — **이 시리즈에서 치른 경기 수**. 대진을 까는 `0xb80a8` 이 0(b811c),
 * 시리즈가 끝나는 승 기록 `0xb7724` 가 −1(b777a), 하루 끝 `0xb818c` 가 늘 +1(b819a) → 새 시리즈 첫 경기는 0.
 * 무승부가 없어 두 팀 승수의 합이다.
 */
export function postseasonGameOf(series: PostseasonSeries): number {
  return series.wins[0] + series.wins[1]
}
