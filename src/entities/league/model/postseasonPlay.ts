import { advancePostseason } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * CPU 끼리의 포스트시즌 진행 (binary.mod 0xc2760 한 경기 · 0x13da0 자동 소화 루프).
 *
 * 원본은 내 팀 차례가 올 때까지 CPU 시리즈를 알아서 끝낸다:
 *   - `playCpuSeriesGame`(0xc2760) 이 한 경기를 연출 없이 돌리고 승패를 기록한 뒤 날짜를 넘긴다
 *   - `autoRunCpuPostseason`(0x13da0) 이 그 시리즈가 끝날 때까지, 그리고 내 차례가 나올 때까지 반복한다
 * 경기 자체는 정규시즌과 같은 타석 엔진을 쓴다 — 포스트시즌 전용 계산은 없다.
 */
/** 한 시리즈는 최대 7경기다. 대진이 셋이라 넉넉히 잡은 안전망 (원본에는 없다) */
const MAXIMUM_GAMES = 40

/** 팀 번호 → 투수 칸(0~7)별 스태미나 `+0x2c` — `playLeagueDay` 의 표와 같은 꼴이다 */
export type PitcherStaminaTable = Readonly<Record<number, readonly number[]>>

/** CPU 끼리 포스트시즌을 돌린 결과 — 시리즈와, 치른 팀만 깎인 스태미나 표 */
export interface CpuPostseasonResult {
  readonly series: PostseasonSeries
  /**
   * 넘긴 표에 이 경기들의 소모를 먹인 것(안 치른 팀은 그대로, 표에 없던 팀은 10000 에서 시작).
   * **회복은 없다** — 0xc2760 이 부르는 하루 끝 0xb818c 의 포스트시즌 갈래(L+0x34 → b8228 → b8320)는
   * 스태미나를 안 건드리고, +20% `0xb617c` 를 부르는 곳은 경기 끝 0x4ea0c(4f2bc) 하나뿐이다.
   */
  readonly pitcherStaminas: PitcherStaminaTable
}

/**
 * 시리즈 한 경기를 CPU 끼리 치르고 결과를 반영한다 (0xc2760) — 두 팀 스태미나를 받아 깎인 값을 돌려준다.
 * 경기는 정규 CPU 경기(0xc2a48)와 같은 팀 객체(0xae800)·간이 엔진으로 서므로 소모도 같다.
 */
export function playCpuSeriesGameWithStamina(
  series: PostseasonSeries,
  random: RandomPort,
  pitcherStaminas: PitcherStaminaTable = {},
): CpuPostseasonResult {
  if (series.round === '종료') return { series, pitcherStaminas }
  const away = series.teams[1]
  const home = series.teams[0]
  // 윗 시드가 홈이다 — 0xb7844 는 포스트시즌에서 series[s][1](올라온 아랫 시드)을 슬롯 1 로 둔다
  const score = simulateLeagueGame({ away, home }, random, undefined, {
    away: pitcherStaminas[away],
    home: pitcherStaminas[home],
  })
  const winner = score.awayRuns > score.homeRuns ? away : home
  return {
    series: advancePostseason(series, winner),
    pitcherStaminas: {
      ...pitcherStaminas,
      [away]: score.pitcherStaminas.away,
      [home]: score.pitcherStaminas.home,
    },
  }
}

/** 시리즈 한 경기를 CPU 끼리 치르고 결과를 반영한다 (0xc2760) — 스태미나는 모두 10000 으로 선다 */
export function playCpuSeriesGame(series: PostseasonSeries, random: RandomPort): PostseasonSeries {
  return playCpuSeriesGameWithStamina(series, random).series
}

/**
 * 내 팀 차례가 나오거나 우승이 정해질 때까지 CPU 끼리 돌린다 (0x13da0 · 시즌 0xef 키 0x9dc8).
 * 내 팀이 이미 지금 시리즈에 있으면 아무것도 하지 않는다. 경기마다 앞 경기의 깎인 스태미나로 선다.
 */
export function runCpuPostseasonWithStamina(
  series: PostseasonSeries,
  myTeamId: number,
  random: RandomPort,
  pitcherStaminas: PitcherStaminaTable = {},
): CpuPostseasonResult {
  let current: CpuPostseasonResult = { series, pitcherStaminas }
  for (let game = 0; game < MAXIMUM_GAMES; game += 1) {
    if (current.series.round === '종료' || isMyTurn(current.series, myTeamId)) return current
    current = playCpuSeriesGameWithStamina(current.series, random, current.pitcherStaminas)
  }
  return current
}

/**
 * 내 팀 차례가 나오거나 우승이 정해질 때까지 CPU 끼리 돌린다 (0x13da0) — 스태미나를 잇지 않는 길
 * (커리어 모드들). 모든 경기가 10000 으로 선다.
 */
export function runCpuPostseason(
  series: PostseasonSeries,
  myTeamId: number,
  random: RandomPort,
): PostseasonSeries {
  return runCpuPostseasonWithStamina(series, myTeamId, random).series
}
