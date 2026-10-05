import { LEAGUE_SIDE_HOME, advancePostseason } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { cpuGameSidesOf, simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * CPU 끼리의 포스트시즌 진행 (binary.mod 0xc2760 한 경기 · 0x13da0 자동 소화 루프).
 *
 * 원본은 내 팀 차례가 올 때까지 CPU 시리즈를 알아서 끝낸다:
 *   - `playCpuSeriesGame`(0xc2760) 이 한 경기를 연출 없이 돌리고 승패를 기록한 뒤 날짜를 넘긴다
 *   - `autoRunCpuPostseason`(0x13da0) 이 그 시리즈가 끝날 때까지, 그리고 내 차례가 나올 때까지 반복한다
 * 경기 자체는 정규시즌과 같은 타석 엔진을 쓴다 — 포스트시즌 전용 계산은 없다.
 *
 * **선발도 정규시즌 CPU 경기와 같은 준비 함수 `0xc239c` 가 정한다** (c28c0 `0xc239c(sim, 모드, L, X, Y)`):
 * ```
 * c24fc  mode = [sp+0x1c]          ; 시즌 0x9dc8(9eba) 은 SR[0] = 2, 나만의리그 0x13da0(13e8a) 은 장면+0xcc = 3·4
 * c24fe  mode == 2 → g = (s8)(0x1f55c()+0xb2)  ; 시즌 저장 레코드 = L+0x32
 *        mode 3·4 → g = (s8)(0x1fa2c()+0xb2)   ; 나만의리그 레코드
 *        g != 0 → 0xb8c80(팀A) ; 0xb8c80(팀B)   ; c2518·c2542 — 0xb5ca8 로테이션 한 칸 (S5 U-16)
 * ```
 * 선발은 늘 로스터 투수 0번이다(0xb891c `team[i] = i`). `(L+0x32) % 4` 를 `state+0x2e+side` 에 쓰는
 * `0xb6c2c`(c2414·c244e)는 이 길에서 **읽히지 않는다** — 그 칸을 읽는 `0xb6c34` 의 호출지는 국가대항전 준비
 * `0xc2c4c`(c2d18) 하나뿐이다. 그래서 P1 1-0 의 "포스트시즌 0xc2c4c ← 0xc2dac" 는 국가대항전 쪽이고, 포스트시즌
 * 0xc2760 에는 `rand(0,4)` 선발도 `% 4` 맞바꿈도 없다.
 *
 * 포스트시즌의 g 는 **시리즈 안에서 치른 경기 수**다: 대진을 까는 `0xb80a8` 이 L+0x32 = 0(b811c)으로 놓고,
 * 시리즈가 끝나는 승 기록 `0xb7724` 가 L+0x32 = −1(b777a)로 놓아 하루 끝 `0xb818c`(b819a, 늘 +1)가 다음 시리즈
 * 첫 경기를 0 으로 만든다. 무승부가 없으니 g = 두 팀 승수의 합이다.
 *
 * ⚠️ 원본 로테이션은 로스터 레코드를 제자리에서 섞어(영구) **앞 시리즈에서 돈 칸이 다음 시리즈로 이어지지만**,
 * 웹은 정규시즌과 같이 g 하나로 셈한다(`rotationSlotOf` 주석 — **근사**). 준PO·PO 를 치르고 올라온 팀의
 * 이월분(그 시리즈 경기 수 − 1 칸)은 시리즈 대진에 남지 않아 빠진다 — 미해결.
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
  // 9eba·13e8a: 0xc2760(…, X = 0xb7648(L, r, 1) = 아랫 시드, Y = 0xb7648(L, r, 0) = 윗 시드).
  // 0xb7844 의 포스트시즌 가지는 아랫 시드를 칸 0(초), 윗 시드를 칸 1(말)에 둔다 (`postseasonSideOf`).
  const x = series.teams[1]
  const y = series.teams[0]
  // ⚠️ 준비 0xc239c 는 칸 sX 의 팀 객체에 Y 의 명단을 싣는다 (`cpuGameSidesOf`) — 초 공격은 **윗 시드의 선수**다
  const sides = cpuGameSidesOf(x, y, 1 - LEAGUE_SIDE_HOME)
  // 선발 = 이 시리즈 g 번 돈 로스터의 0번 (0xc239c c24fc~c254e, 위 주석) — 굴림이 없다
  const day = series.wins[0] + series.wins[1]
  const score = simulateLeagueGame(sides, random, rotationSlotOf(day), {
    away: pitcherStaminas[sides.away],
    home: pitcherStaminas[sides.home],
  })
  // c28e2~c290a: `score(sX) > score(sY)` 면 X 승, 아니면(동점 포함) Y 승. 칸 sX(초)에서 친 것은 Y 의 선수라
  // **점수를 덜 낸 명단의 팀이 이긴다** — 원본 버그 그대로 (R1 항목 4 는 명단 엇갈림을 못 보고 "정상" 으로 읽었다)
  const winner = score.awayRuns > score.homeRuns ? x : y
  const away = sides.away
  const home = sides.home
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
