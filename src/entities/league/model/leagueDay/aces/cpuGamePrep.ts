import { LEAGUE_SIDE_HOME } from '@/entities/league/model/league'
import { rollOpponentAceIndex } from '@/entities/game/model/aceOpponent'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { LeagueGameAces, LeagueGameExtras } from '@/entities/league/model/leagueDay/types/leagueGameExtras'

/** CPU 끼리 경기 준비 `0xc239c` 의 굴림 다섯 (c2464~c24ea) */
export interface CpuGamePrepRolls {
  /**
   * c2464 `rand(0,4)` → `state+0x30` = **구장 번호**. 일반모드 경기 세우기 `0x30f20` 이 같은 칸에 준비 기록의 구장
   * `rec+0xc`(310e2~310ec)를, 국가대항전 준비 `0xc2c4c`(c2cf6)·경기 장면 진입(3a032)이 `0xff`(없음)를 쓴다.
   * 간이 엔진 쪽에서 이 칸을 읽는 곳은 못 찾았다 — 웹은 굴림만 소모하고 값은 쓰지 않는다.
   */
  readonly stadium: number
  /** 칸 sX 의 팀 객체(= Y 의 명단, `cpuGameSidesOf`) — c2470 x → `0xb8870(x)`, c247a y → `0xb88c8(y)` */
  readonly teamA: LeagueGameAces
  /** 칸 sY 의 팀 객체(= X 의 명단) — c24d8 `0xb88c8(0x66968(y))` → c24ea `0xb8870(0x66994(x))` */
  readonly teamB: LeagueGameAces
}

/**
 * `0xc239c` 가 두 팀 객체를 만든 직후 부르는 굴림 다섯 — 차례 그대로다 (직접 떴다):
 * ```
 * c2464  state+0x30 = rand(0,4)             ; 구장
 * c2470  x = rand(0,5) ; c247a  y = rand(0,5)
 * c2494  0xb891c(A) ; 0xb8768(A) ; c24aa 0xb8870(A, x) ; c24b6 0xb88c8(A, y)
 * c24ce  0xb891c(B) ; 0xb8768(B) ; c24dc v = 0x66968(y) ; 0xb88c8(B, v) ; c24ee w = 0x66994(x) ; 0xb8870(B, w)
 * ```
 * `0x66968`·`0x66994` 는 같은 함수로, 안에서 `rand(0,5)` 한 번 — 넘긴 번호와 겹치면 하나 내린다(`rollOpponentAceIndex`).
 * 그래서 두 팀의 마타자·마투수는 늘 서로 다르다. 팀 세우기 `0xb891c`·`0xb8768`·`0xb8870`·`0xb88c8` 은 굴리지 않는다
 * (R4 3c 의 일반모드 굴림 넷과 같은 함수들).
 */
export function rollCpuGamePrep(random: RandomPort): CpuGamePrepRolls {
  const stadium = random.rand(0, 4)
  const x = random.rand(0, 5)
  const y = random.rand(0, 5)
  const pitcherB = rollOpponentAceIndex(y, random)
  const batterB = rollOpponentAceIndex(x, random)
  return { stadium, teamA: { batter: x, pitcher: y }, teamB: { batter: batterB, pitcher: pitcherB } }
}

/**
 * 굴림을 명단 쪽(`cpuGameSidesOf` 의 away·home)으로 — 팀 A 는 **칸 sX 의 객체**다.
 * `sideOfX` 가 홈(1)이면 A 는 말 공격 명단, 원정(0)이면 초 공격 명단이다.
 */
export function cpuGameAcesOf(rolls: CpuGamePrepRolls, sideOfX: number = LEAGUE_SIDE_HOME): NonNullable<LeagueGameExtras['aces']> {
  return sideOfX === LEAGUE_SIDE_HOME ? { away: rolls.teamB, home: rolls.teamA } : { away: rolls.teamA, home: rolls.teamB }
}
