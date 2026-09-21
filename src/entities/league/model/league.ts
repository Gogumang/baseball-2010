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

export interface League {
  readonly wins: readonly number[]
  readonly losses: readonly number[]
  readonly streak: readonly number[]
  readonly bestStreak: readonly number[]
  readonly losingStreak: readonly number[]
  /** headToHead[a][b] = a 가 b 에게 이긴 수 */
  readonly headToHead: readonly (readonly number[])[]
}

const zeros = () => Array.from({ length: LEAGUE_TEAM_COUNT }, () => 0)

export const EMPTY_LEAGUE: League = {
  wins: zeros(),
  losses: zeros(),
  streak: zeros(),
  bestStreak: zeros(),
  losingStreak: zeros(),
  headToHead: Array.from({ length: LEAGUE_TEAM_COUNT }, zeros),
}

const replaced = (values: readonly number[], index: number, value: number) =>
  values.map((current, position) => (position === index ? value : current))

export function recordLeagueResult(league: League, winner: number, loser: number): League {
  const winnerStreak = league.streak[winner] + 1
  return {
    wins: replaced(league.wins, winner, league.wins[winner] + 1),
    losses: replaced(league.losses, loser, league.losses[loser] + 1),
    streak: replaced(replaced(league.streak, winner, winnerStreak), loser, 0),
    bestStreak: replaced(league.bestStreak, winner, Math.max(league.bestStreak[winner], winnerStreak)),
    losingStreak: replaced(replaced(league.losingStreak, loser, league.losingStreak[loser] + 1), winner, 0),
    headToHead: league.headToHead.map((row, team) =>
      team === winner ? replaced(row, loser, row[loser] + 1) : row,
    ),
  }
}

/**
 * 순위(1위부터 팀 번호) — 원본 0xb79d8 의 **선택 정렬을 그대로 옮긴 것**이다.
 * 순서 배열 초기값은 표 0xd8a25 = `[0,1,…,9]`, 승·패 사본을 함께 swap 하며 훑는다.
 *
 * ⚠️ **원본 버그를 그대로 둔다** (E 2절·3e 확정 · DECISIONS 2026-09-20):
 * 상대전적 표 `headToHead` 는 **팀 번호**로 된 표인데, 비교에 쓰는 `best`·`j` 는 정렬 중인
 * **배열 위치**다. 표를 함께 섞지도 않는다 → swap 이 한 번이라도 일어나면 엉뚱한 팀끼리의
 * 전적을 비교한다. 상대전적까지 같으면 `best` 를 바꾸지 않으므로 마지막 기준은
 * "현재 배열 위치가 앞선 팀" 이고, 초기값 덕에 대체로 팀 번호 순으로 보이지만 엄밀히는 아니다.
 */
export function rankingOf(league: League): number[] {
  const order = Array.from({ length: LEAGUE_TEAM_COUNT }, (_unused, team) => team)
  const wins = [...league.wins]
  const losses = [...league.losses]

  for (let i = 0; i < LEAGUE_TEAM_COUNT - 1; i += 1) {
    let best = i
    for (let j = i + 1; j < LEAGUE_TEAM_COUNT; j += 1) {
      if (wins[best] < wins[j]) best = j
      else if (wins[best] === wins[j] && losses[best] > losses[j]) best = j
      // 색인 버그: j·best 는 배열 위치인데 headToHead 는 팀 번호 표다 (원본 그대로)
      else if (
        wins[best] === wins[j] &&
        losses[best] === losses[j] &&
        league.headToHead[j][best] > league.headToHead[best][j]
      ) best = j
    }
    ;[wins[i], wins[best]] = [wins[best], wins[i]]
    ;[losses[i], losses[best]] = [losses[best], losses[i]]
    ;[order[i], order[best]] = [order[best], order[i]]
  }

  return order
}

export const POSTSEASON_TEAM_COUNT = 4

export type PostseasonRound = '준플레이오프' | '플레이오프' | '한국시리즈' | '종료'

export interface PostseasonSeries {
  readonly round: PostseasonRound
  /** 진출 팀 (1~4위) */
  readonly qualifiers: readonly number[]
  /** [윗 시드, 아랫 시드] */
  readonly teams: readonly [number, number]
  readonly wins: readonly [number, number]
  readonly winsNeeded: number
  readonly champion: number | null
}

/** 시리즈 길이 표 [7, 5, 5] — 라운드 2(준PO) → 1(PO) → 0(KS) */
const WINS_NEEDED: Readonly<Record<Exclude<PostseasonRound, '종료'>, number>> = {
  준플레이오프: 3,
  플레이오프: 3,
  한국시리즈: 4,
}

export function startPostseason(ranking: readonly number[]): PostseasonSeries {
  const qualifiers = ranking.slice(0, POSTSEASON_TEAM_COUNT)
  return {
    round: '준플레이오프',
    qualifiers,
    teams: [qualifiers[2], qualifiers[3]],
    wins: [0, 0],
    winsNeeded: WINS_NEEDED.준플레이오프,
    champion: null,
  }
}

/** 한 경기 결과를 넣는다. 시리즈가 끝나면 이긴 팀이 다음 라운드의 아랫 시드로 올라간다 */
export function advancePostseason(series: PostseasonSeries, winner: number): PostseasonSeries {
  if (series.round === '종료') return series
  const side = series.teams[0] === winner ? 0 : 1
  const wins: [number, number] = side === 0 ? [series.wins[0] + 1, series.wins[1]] : [series.wins[0], series.wins[1] + 1]
  if (wins[side] < series.winsNeeded) return { ...series, wins }
  if (series.round === '한국시리즈') return { ...series, wins, round: '종료', champion: winner }
  const next = series.round === '준플레이오프' ? '플레이오프' : '한국시리즈'
  const topSeed = series.qualifiers[next === '플레이오프' ? 1 : 0]
  return { ...series, round: next, teams: [topSeed, winner], wins: [0, 0], winsNeeded: WINS_NEEDED[next] }
}

