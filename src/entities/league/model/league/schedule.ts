/**
 * 리그 순위표·일정·포스트시즌 (binary.mod 0xb7xxx — 누락 탐색 9차, 바이트 확인).
 *   일정   상대 = 표 0xd89cb[(일차 mod 9)×10 + 팀] — 9일 라운드로빈 × 5 = 45경기
 *   승패   0xb76dc 승(승·연승·최다 연승·상대 전적, 연패 0) · 0xb77e0 패(패·연패·최다 연승 갱신, 연승 0)
 *   순위   0xb79d8 승 많은 순 → 패 적은 순 → 상대 전적. 4위 이내 진출
 *   대진   0xb80a8 준PO 3위 vs 4위(5전3선승) → PO 2위(5전3선승) → KS 1위(7전4선승)
 */
export const LEAGUE_TEAM_COUNT = 10
const SCHEDULE_DAYS = 9

const SCHEDULE: readonly (readonly number[])[] = [
  [1, 0, 3, 2, 5, 4, 7, 6, 9, 8],
  [2, 3, 0, 1, 6, 8, 4, 9, 5, 7],
  [3, 4, 8, 0, 1, 7, 9, 5, 2, 6],
  [4, 2, 1, 6, 0, 9, 3, 8, 7, 5],
  [5, 6, 7, 8, 9, 0, 1, 2, 3, 4],
  [6, 7, 5, 9, 8, 2, 0, 1, 4, 3],
  [7, 8, 9, 4, 3, 6, 5, 0, 1, 2],
  [8, 9, 6, 5, 7, 3, 2, 4, 0, 1],
  [9, 5, 4, 7, 2, 1, 8, 3, 6, 0],
]

export function opponentOf(day: number, team: number): number {
  return SCHEDULE[day % SCHEDULE_DAYS][team]
}

/**
 * 그날 그 팀이 홈인가 원정인가 (`0xb7844`, R1 1절 확정).
 *
 * ```
 * d  = 날짜 (리그+0x32, 치른 경기 수)
 * r7 = (d / 9) & 1          ; 9일 주기가 한 바퀴 돌 때마다 뒤집힌다
 * d > 22 면 r7 을 한 번 더 뒤집는다
 * 짝 중 **번호가 큰 쪽**이 r7, 작은 쪽이 !r7  → 두 팀은 늘 반대 값
 * ```
 *
 * 돌려주는 값이 원본 side 다 — **1 = 홈(말 공격) · 0 = 원정(초 공격)** (A목록 +8 이 side 1).
 */
export function leagueSideOf(day: number, team: number): number {
  const rounds = Math.trunc(day / SCHEDULE_DAYS) & 1
  const flipped = day > SIDE_FLIP_DAY ? 1 - rounds : rounds
  return team > opponentOf(day, team) ? flipped : 1 - flipped
}

/** 홈/원정이 한 번 더 뒤집히는 날 — `d > 0x16` (0xb78f4) */
const SIDE_FLIP_DAY = 22
/** 원본 side 1 = 홈(말 공격) */
export const LEAGUE_SIDE_HOME = 1
