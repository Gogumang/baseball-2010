import { LEAGUE_SIDE_HOME, LEAGUE_TEAM_COUNT, leagueSideOf, opponentOf } from '@/entities/league/model/league'

export interface LeagueMatchup {
  /** 먼저 공격하는 쪽 */
  readonly away: number
  readonly home: number
}

/**
 * 오늘 치르는 다섯 경기. 일정표 0xd89cb 를 팀 번호가 작은 쪽부터 훑어 짝을 짓는다.
 *
 * 홈/원정은 **원본 `0xb7844` 그대로**다 (R1 항목 2·5 확정, `leagueSideOf`):
 * ```
 * r7 = (일차 / 9) & 1 ; 일차 > 22 면 r7 을 한 번 더 뒤집는다
 * 짝 중 번호가 큰 쪽 = r7, 작은 쪽 = !r7      ; 두 팀은 늘 반대 값
 * side 1 = 홈(말 공격) · 0 = 원정(초 공격)     ; A목록(+8)이 side 1
 * ```
 * 그래서 9일 주기가 한 바퀴 돌 때마다, 그리고 23일째부터 한 번 더 홈/원정이 뒤집힌다.
 * (예전에는 "번호 작은 팀이 원정" 으로 고정해 두었다 — U-40, 이제 닫혔다.)
 *
 * 대진을 채우는 순서(번호 작은 팀부터)는 원본 0xc2a48 첫머리와 같다 — 원본도 팀 0 부터
 * 훑어 빈 칸을 채우므로 **경기 순서**는 그대로고 바뀌는 것은 어느 쪽이 먼저 공격하느냐다.
 */
export function matchupsOf(day: number): readonly LeagueMatchup[] {
  const matchups: LeagueMatchup[] = []
  const scheduled = new Set<number>()
  for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) {
    if (scheduled.has(team)) continue
    const opponent = opponentOf(day, team)
    scheduled.add(team)
    scheduled.add(opponent)
    matchups.push(leagueSideOf(day, team) === LEAGUE_SIDE_HOME ? { away: opponent, home: team } : { away: team, home: opponent })
  }
  return matchups
}

/**
 * CPU 끼리 경기 준비 `0xc239c(sim, 모드, L, X, Y)` 가 **명단을 앉히는 칸** — 공격 차례(칸 0 = 초, 칸 1 = 말)로 본
 * 두 팀의 **선수**다. 돌려주는 `away` 의 선수가 먼저 공격하고, `home` 의 선수가 나중에 공격한다.
 *
 * 직접 떴다 (스택 인자 Y = `[sp+0x34]`, X = `[sp+0x18]`):
 * ```
 * c23d4  sX = 0xb7844(L, X) ; c23de  sY = 0xb7844(L, Y)
 * c2418  0xb6bd4(state, sX, X)              ; state[0x28+sX] = X   (팀 번호 칸 — 점수 칸 st+0x7e+s 와 같은 번호)
 * c2452  0xb6bd4(state, sY, Y)              ; state[0x28+sY] = Y
 * c2494  0xb891c(팀객체[sX], 모드, **Y**, −1)  ; ← 칸 sX 의 팀 객체 +0x25 = Y
 * c24ce  0xb891c(팀객체[sY], 모드, **X**, −1)  ; ← 칸 sY 의 팀 객체 +0x25 = X
 * ```
 * 팀 객체는 `엔진+0x6c + 칸×4` 에 있고 간이 엔진이 공격 팀을 `[엔진+0x6c + st[9]×4]` 로 집는다(c19b8), 선수 레코드는
 * `0xb8680(팀객체)` 이 모드 2·3·4 에서 `팀객체+0x25` 의 팀 번호로 꺼낸다(b869e → 0x1f570). 곧 **칸 sX 에서 치고 던지는
 * 것은 Y 의 선수**다. 국가대항전 준비 `0xc2c4c` 도 같은 꼴이다(c2cb6 칸 1 = X 인데 c2d06 칸 0 객체 ← X).
 *
 * 점수 `st+0x7e+s` 는 그 칸에서 친 선수의 득점이므로, 승패를 칸으로 매기는 두 경기 함수의 결과가 R1 의 해석과 갈린다:
 * - 정규 `0xc2a48`: X = 홈(side 1). `score(0) > score(1)` → X 승 — 칸 0 은 X 의 선수라 **더 낸 쪽이 이긴다**.
 * - 포스트시즌 `0xc2760`: X = 아랫 시드(side 0). `score(sX) > score(sY)` → X 승 — 칸 sX 는 Y 의 선수라
 *   **덜 낸 쪽이 이긴다**(원본 버그, 그대로 옮긴다).
 */
export function cpuGameSidesOf(x: number, y: number, sideOfX: number = LEAGUE_SIDE_HOME): LeagueMatchup {
  // 칸 sX 에는 Y 의 선수, 칸 sY 에는 X 의 선수
  return sideOfX === LEAGUE_SIDE_HOME ? { away: x, home: y } : { away: y, home: x }
}
