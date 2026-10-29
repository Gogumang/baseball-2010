import type { League } from '@/entities/league/model/league/standings'
import { POSTSEASON_TEAM_COUNT, type PostseasonRound, type PostseasonSeries } from '@/entities/league/model/league/postseasonTypes'
import { LEAGUE_SIDE_HOME } from '@/entities/league/model/league/schedule'

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

/** 그 경기를 이긴 쪽 승수를 하나 올린 두 칸 */
function winsAfter(series: PostseasonSeries, side: 0 | 1): [number, number] {
  return side === 0 ? [series.wins[0] + 1, series.wins[1]] : [series.wins[0], series.wins[1] + 1]
}

/** 시리즈가 끝났다 — n 경기 동안 두 팀은 g = 1..n−1 에서 한 칸씩, n − 1 칸 돌았다 (레코드에 남는다) */
function rotationsAfterSeries(series: PostseasonSeries, wins: readonly [number, number]): Readonly<Record<number, number>> {
  const turned = wins[0] + wins[1] - 1
  return {
    ...series.rotations,
    [series.teams[0]]: (series.rotations?.[series.teams[0]] ?? 0) + turned,
    [series.teams[1]]: (series.rotations?.[series.teams[1]] ?? 0) + turned,
  }
}

/** 준PO · PO 가 끝났다 — 이긴 팀이 다음 라운드의 아랫 시드(0xb7724 의 칸 1)로 올라간다 */
function nextRoundOf(series: PostseasonSeries, rotations: Readonly<Record<number, number>>, winner: number): PostseasonSeries {
  const isSemiPlayoff = series.round === '준플레이오프'
  const next = isSemiPlayoff ? '플레이오프' : '한국시리즈'
  const topSeed = series.qualifiers[isSemiPlayoff ? 1 : 0]
  return {
    ...series,
    round: next,
    teams: [topSeed, winner],
    wins: [0, 0],
    winsNeeded: WINS_NEEDED[next],
    rotations,
    // 0xb7724 — 준PO 승자는 플레이오프 칸 1(L+0x3b)에 들어가 포스트시즌 끝까지 남는다
    ...(isSemiPlayoff ? { semiPlayoffWinner: winner } : {}),
  }
}

/** 한 경기 결과를 넣는다. 시리즈가 끝나면 이긴 팀이 다음 라운드의 아랫 시드로 올라간다 */
export function advancePostseason(series: PostseasonSeries, winner: number): PostseasonSeries {
  if (series.round === '종료') return series
  const side = series.teams[0] === winner ? 0 : 1
  const wins = winsAfter(series, side)
  if (wins[side] < series.winsNeeded) return { ...series, wins }
  const rotations = rotationsAfterSeries(series, wins)
  if (series.round === '한국시리즈') return { ...series, wins, rotations, round: '종료', champion: winner }
  return nextRoundOf(series, rotations, winner)
}

/**
 * **옛 저장 이사** — `semiPlayoffWinner` 가 생기기 전 저장의 시리즈에 준PO 승자를 채운다.
 *
 * - 플레이오프 중이면 아랫 시드 `teams[1]` 이 곧 준PO 승자다.
 * - 한국시리즈 · 종료면 아랫 시드가 2위가 아닐 때 그 팀(플레이오프 승자)이 준PO 승자다.
 * - 아랫 시드가 2위면 3·4위 중 **로테이션 칸(`rotations`)이 많은 팀**이다 — 두 팀이 준PO 에서 같은 n − 1 칸을 돌았고,
 *   승자만 플레이오프(3선승이라 3경기 이상)에서 2 칸 이상을 더 돌았다(`advancePostseason`).
 * - 로테이션 칸도 없는 더 옛 저장은 알 길이 없어 비워 둔다 — 지어내지 않는다.
 */
export function withSemiPlayoffWinner(series: PostseasonSeries): PostseasonSeries {
  if (series.semiPlayoffWinner !== undefined || series.round === '준플레이오프') return series
  const inferred = inferredSemiPlayoffWinnerOf(series)
  return inferred === null ? series : { ...series, semiPlayoffWinner: inferred }
}

function inferredSemiPlayoffWinnerOf(series: PostseasonSeries): number | null {
  if (series.round === '플레이오프') return series.teams[1]
  const [, second, third, fourth] = series.qualifiers
  if (series.teams[1] !== second) return series.teams[1]
  return moreRotatedTeamOf(series.rotations, third, fourth)
}

/** 아랫 시드가 2위면 3·4위 중 로테이션 칸이 많은 팀 — 같거나 칸이 없으면 알 길이 없어 null */
function moreRotatedTeamOf(rotations: PostseasonSeries['rotations'], third: number | undefined, fourth: number | undefined): number | null {
  if (third === undefined || fourth === undefined || rotations === undefined) return null
  const thirdTurns = rotations[third] ?? 0
  const fourthTurns = rotations[fourth] ?? 0
  if (thirdTurns === fourthTurns) return null
  return thirdTurns > fourthTurns ? third : fourth
}
