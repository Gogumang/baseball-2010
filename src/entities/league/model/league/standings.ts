import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league/schedule'

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
    headToHead: league.headToHead.map((row, team) => (team === winner ? replaced(row, loser, row[loser] + 1) : row)),
  }
}

/**
 * 새 시즌 리그 — 승패는 비우고 **투수 레코드 차례는 잇는다**. 원본 새 시즌 처리는 팀 저장 레코드를 다시 짓지 않으므로
 * 지난 시즌(포스트시즌 포함)에 섞인 차례가 그대로 남는다. 포스트시즌을 치렀으면 `pitcherOrdersAfterPostseason` 을 넘긴다.
 */
export function nextSeasonLeague(pitcherOrders: League['pitcherOrders']): League {
  return pitcherOrders === undefined ? EMPTY_LEAGUE : { ...EMPTY_LEAGUE, pitcherOrders }
}
