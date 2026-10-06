import { advanceRotation } from '@/entities/pitcher-career/model/pitcherRotation'

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
  /**
   * 팀 번호 → **투수 레코드 차례** — 칸 p 에 지금 앉은 레코드의 붙박이 표 칸(0~7). 없으면 `[0..7]` 그대로다.
   *
   * 원본 로테이션 `0xb5ca8` 은 팀 저장 레코드의 투수 0~3 을 제자리에서 한 칸 당긴다(영구) — 경기용 팀 객체는
   * `team[i] = i`(0xb891c)라 늘 0번 레코드가 선발이고, 벤치 차례(교체 0xabfcc 가 보는 `team+0x0c` 차례)도 이 차례다.
   * 섞인 차례는 저장에 남아 **새 시즌으로 이어지고**(새 시즌 처리는 레코드를 되돌리지 않는다), 투수편의 0↔k 맞바꿈
   * (0xa4f60 → 0xb8c94)·새 시즌 0↔k(0x1b684) 같은 다른 뒤섞임과 겹쳐 쌓인다. 웹 로스터는 붙박이 표라 레코드를 되쓰지
   * 않고 이 차례만 들고 다닌다 — 투수 기록·스태미나는 붙박이 칸 번호로 센다(레코드를 따라간다).
   *
   * 옛 저장에는 이 칸이 없다 — `[0..7]` 로 본다(저장 형식 번호는 올리지 않는다).
   */
  readonly pitcherOrders?: Readonly<Record<number, readonly number[]>>
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
    // 투수 레코드 차례(`pitcherOrders`)처럼 승패와 상관없는 칸은 그대로 둔다
    ...league,
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

/**
 * 새 시즌 리그 — 승패는 비우고 **투수 레코드 차례는 잇는다**. 원본 새 시즌 처리는 팀 저장 레코드를 다시 짓지 않으므로
 * 지난 시즌(포스트시즌 포함)에 섞인 차례가 그대로 남는다. 포스트시즌을 치렀으면 `pitcherOrdersAfterPostseason` 을 넘긴다.
 */
export function nextSeasonLeague(pitcherOrders: League['pitcherOrders']): League {
  return pitcherOrders === undefined ? EMPTY_LEAGUE : { ...EMPTY_LEAGUE, pitcherOrders }
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
  /**
   * 앞서 **끝난** 포스트시즌 시리즈에서 팀마다 돈 로테이션 수 (팀 번호 → 횟수). 없으면 0.
   *
   * 원본 로테이션 `0xb5ca8` 은 팀 레코드를 제자리에서 섞어(영구) 경기 준비마다 g ≠ 0 이면 한 칸 돈다
   * (CPU 경기 `0xc239c` c24fc~c254e · 사람 경기 `0x6548` 670e~673e). 포스트시즌 g(`L+0x32`)는 시리즈마다 0 부터라
   * n 경기 시리즈에서 두 팀이 n − 1 칸씩 돌고, 그 칸이 **다음 시리즈로 이어진다**. `advancePostseason` 이 시리즈가
   * 끝날 때 쌓는다 (옛 저장에는 없다 — 0 으로 본다).
   */
  readonly rotations?: Readonly<Record<number, number>>
  /**
   * 포스트시즌을 시작할 때(정규시즌이 끝났을 때)의 투수 레코드 차례 — `startPostseason` 에 리그의 `pitcherOrders` 를
   * 넘기면 담긴다. 있으면 선발은 이 차례를 `rotations + g` 칸 더 돌린 0번이고, 없으면(옛 저장) 정규 44 칸을 돈
   * `[0..7]` 로 본다.
   */
  readonly baseOrders?: Readonly<Record<number, readonly number[]>>
}

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
    const base =
      series.baseOrders?.[team] ??
      regularSeasonOrders?.[team] ??
      rotatedBy(UNSHUFFLED_PITCHER_ORDER, REGULAR_SEASON_DAYS - 1)
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

/** 시리즈 길이 표 [7, 5, 5] — 라운드 2(준PO) → 1(PO) → 0(KS) */
const WINS_NEEDED: Readonly<Record<Exclude<PostseasonRound, '종료'>, number>> = {
  준플레이오프: 3,
  플레이오프: 3,
  한국시리즈: 4,
}

export function startPostseason(
  ranking: readonly number[],
  /** 정규시즌이 끝났을 때 리그의 투수 레코드 차례 (`League.pitcherOrders`). 안 넘기면 44 칸 돈 `[0..7]` 로 본다 */
  pitcherOrders?: League['pitcherOrders'],
): PostseasonSeries {
  const qualifiers = ranking.slice(0, POSTSEASON_TEAM_COUNT)
  return {
    ...(pitcherOrders === undefined ? {} : { baseOrders: pitcherOrders }),
    round: '준플레이오프',
    qualifiers,
    teams: [qualifiers[2], qualifiers[3]],
    wins: [0, 0],
    winsNeeded: WINS_NEEDED.준플레이오프,
    champion: null,
  }
}

/**
 * 포스트시즌에서 그 팀이 홈인가 원정인가 — `0xb7844` 의 **`리그+0x34 != 0`** 가지 (확정).
 *
 * ```
 * b78e0: r3 = L + 0x35 ; r1 = (s8)[r3]        ; 라운드 r (2 준PO → 1 PO → 0 KS)
 * b78e8: r2 = 1
 * b78ea: bl 0xb7648                           ; = (s8) L[0x38 + 2*r + 1] = 대진 아랫 시드
 * b78ee: eors r0, r5 ; rsbs r3,r0,#0 ; orrs r3,r0 ; lsrs r0,r3,#0x1f
 *                                             ; → 아랫 시드면 0, 아니면 1
 * ```
 *
 * 곧 **윗 시드가 늘 side 1(홈·후공), 아랫 시드가 늘 side 0(원정·선공)** 이다.
 * 시리즈 몇 차전인지(`L+0x32`)는 보지 않는다 — 차수에 따라 홈이 도는 규칙이 원본에 없다.
 * (대진 칸은 `0xb80a8` 이 `L[0x38]=1위, L[0x39]=미정, L[0x3a]=2위, L[0x3b]=미정,
 *  L[0x3c]=3위, L[0x3d]=4위` 로 깔고, 시리즈가 끝나면 `0xb7724` 가 이긴 팀을
 *  다음 라운드의 **칸 1**(아랫 시드)에 넣는다 — 웹 `advancePostseason` 과 같다.)
 */
export function postseasonSideOf(series: PostseasonSeries, team: number): number {
  return team === series.teams[1] ? 1 - LEAGUE_SIDE_HOME : LEAGUE_SIDE_HOME
}

/** 한 경기 결과를 넣는다. 시리즈가 끝나면 이긴 팀이 다음 라운드의 아랫 시드로 올라간다 */
export function advancePostseason(series: PostseasonSeries, winner: number): PostseasonSeries {
  if (series.round === '종료') return series
  const side = series.teams[0] === winner ? 0 : 1
  const wins: [number, number] = side === 0 ? [series.wins[0] + 1, series.wins[1]] : [series.wins[0], series.wins[1] + 1]
  if (wins[side] < series.winsNeeded) return { ...series, wins }
  // 시리즈가 끝났다 — n 경기 동안 두 팀은 g = 1..n−1 에서 한 칸씩, n − 1 칸 돌았다 (레코드에 남는다)
  const turned = wins[0] + wins[1] - 1
  const rotations = {
    ...series.rotations,
    [series.teams[0]]: (series.rotations?.[series.teams[0]] ?? 0) + turned,
    [series.teams[1]]: (series.rotations?.[series.teams[1]] ?? 0) + turned,
  }
  if (series.round === '한국시리즈') return { ...series, wins, rotations, round: '종료', champion: winner }
  const next = series.round === '준플레이오프' ? '플레이오프' : '한국시리즈'
  const topSeed = series.qualifiers[next === '플레이오프' ? 1 : 0]
  return { ...series, round: next, teams: [topSeed, winner], wins: [0, 0], winsNeeded: WINS_NEEDED[next], rotations }
}

