import {
  LEAGUE_SIDE_HOME,
  LEAGUE_TEAM_COUNT,
  leagueSideOf,
  opponentOf,
  recordLeagueResult,
} from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import { simulateHalfInning, startingMoundOf } from '@/entities/game/model/simulateHalfInning'
import type {
  HalfInningDefense,
  HalfInningMound,
  HalfInningResult,
} from '@/entities/game/model/simulateHalfInning'
import { rosterLineupOf } from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { ACE_BATTERS, ACE_PITCHERS, rollOpponentAceIndex } from '@/entities/game/model/aceOpponent'
import { EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { aceAbilityAtLevel, aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import {
  BATTERS_PER_TEAM,
  PITCHERS_PER_TEAM,
  batterAt,
  quickPitcherOf,
  rollStartingPitcherIndex,
  startingPitcherOf,
  teamPitchers,
} from '@/entities/team/model/teamRoster'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  EMPTY_LEAGUE_PLAYER_STATS,
  recordLeaguePitcherAppearances,
  recordLeaguePlateAppearances,
} from '@/entities/league/model/leaguePlayerStats'
import type {
  LeaguePitcherAppearance,
  LeaguePlateAppearance,
  LeaguePlayerStats,
} from '@/entities/league/model/leaguePlayerStats'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 하루치 리그 경기 (binary.mod 0xc2a48).
 * 원본은 팀 전력으로 점수를 뽑지 않는다 — 오늘의 다섯 대진을 짜고, 내 팀 경기만 빼고
 * 나머지를 **사람 경기와 같은 타석 엔진**으로 끝까지 돌린 뒤 최종 점수를 읽어 승패를 기록한다.
 *
 * **무승부가 없다.** 리그 구조체에 무승부 칸 자체가 없어서, 점수가 같으면 한쪽이 승으로 들어간다.
 */
export const REGULAR_INNINGS = 9
/**
 * **원본에는 연장 상한이 없다** (E 3d 확정): 이닝 증가 0xb6b6c 에 막는 값이 없고, 경기 끝 판정
 * 0xb68fc 는 동점이면 절대 끝내지 않으며, 점수판 0xb6988 은 `이닝 mod 9` 로 칸을 돌려 쓴다.
 * 여기 값은 무한 루프를 막는 **우리 쪽 안전망**일 뿐이라 원본 동작이 아니다 — 실제로 걸리는 일은 거의 없다.
 * (0xc262c 의 이닝 14 는 상한이 아니라 "15회에 스윙 강제" 였다. `quickAtBat.ts` 참고)
 */
export const MAXIMUM_INNINGS = 30

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
    matchups.push(
      leagueSideOf(day, team) === LEAGUE_SIDE_HOME
        ? { away: opponent, home: team }
        : { away: team, home: opponent },
    )
  }
  return matchups
}

export interface LeagueGameScore {
  readonly awayRuns: number
  readonly homeRuns: number
  /**
   * 이 경기에서 나온 **선수별 타석 결과**. 원본은 CPU 끼리 경기도 사람 경기와 같은 기록 함수
   * 0xa8024 를 불러 선수 레코드에 타수·안타·홈런·타점을 쌓는다 (B-2 확정) — 웹도 여기서
   * 결과를 버리지 않고 내보내, `playLeagueDay` 가 리그 선수 기록표에 쌓는다.
   */
  readonly plateAppearances: readonly LeaguePlateAppearance[]
  /**
   * 이 경기에서 나온 **투수 기록** — 던진 투수마다 한 줄이다. 타석마다 도는 CPU 교체
   * (0xc1ba4 → 0xac428)로 한 팀에서 여럿이 나올 수 있다. 원본도 같은 레코드에 아웃 +0x20 ·
   * 실점 +0x22 · 탈삼진 +0x26 · 투구 수 +0x28 을 쌓고, 경기 끝 0xa7de8 이 승 +0x2e · 패 +0x2f 를
   * 매긴다 (P1-pitcher-rules.md 6절). 세이브 +0x24 는 **원본이 한 번도 안 준다** (CORRECTIONS 2-1).
   */
  readonly pitcherAppearances: readonly LeaguePitcherAppearance[]
  /**
   * 이 경기에서 나온 도루 수 (0xc1818, E-5). 원본은 주자 레코드에 도루를 +1 하지만
   * 웹 리그 선수 기록표(`LeagueBatterLine`)에는 도루 칸이 없어 **경기 합계만** 내놓는다.
   */
  readonly steals: number
  /**
   * 이 경기에 들어온 CPU 대타 (0xac228) — 막음 칸 `state[0xe]` 는 공마다 내려가므로(`0xa5e14` a5e7c) 한 경기에
   * **여러 번** 나올 수 있다. 상한은 두 팀 벤치 수(`team+0x28c`, 붙박이 로스터는 셋씩)다.
   * 들어온 선수의 타석은 `plateAppearances` 에 그 선수의 로스터 칸으로 이미 들어 있다.
   */
  readonly pinchHits: number
  /**
   * 경기가 끝났을 때 **두 팀 투수 칸(0~7)별 스태미나** `+0x2c` — 넘긴 시작 값에서 간이 엔진 소모(0xa5e14 → 0xaeb08,
   * 투구마다)를 뺀 것. 원본은 레코드에 남아 다음 경기로 이어진다 (a583fe0). 저장과 하루 끝 회복은 부르는 쪽 몫이다.
   */
  readonly pitcherStaminas: { readonly away: readonly number[]; readonly home: readonly number[] }
}

/** 투수 칸별 스태미나 — 모자란 칸은 가득 */
function staminaTableOf(given: readonly number[] | undefined): number[] {
  return ALL_PITCHER_SLOTS.map((slot) => given?.[slot] ?? FULL_STAMINA)
}

/** 반 이닝이 내놓은 교체(내려간 투수 값)와 끝 마운드를 칸별 표에 되적는다 */
function chargeStaminas(table: number[], half: HalfInningResult, mound: HalfInningMound | undefined): void {
  for (const change of half.pitcherChanges ?? []) table[change.outgoingPitcherSlot] = change.outgoingStamina
  if (mound !== undefined) table[mound.pitcherSlot] = mound.stamina
}

/**
 * 타순 칸 수. 팀 객체 `team+0xe..+0x16` 아홉 칸이 타순이고, 타석이 끝나면 `0xaf020` 이
 * `(team+0x32 + 1) mod 9` 로 다음 칸을 세운다 (E 3b 확정). 로스터 열두 명 중 뒤 셋은 벤치라
 * **타순에 서지 않는다** — 예전에는 커서를 12 로 나눠 벤치 셋까지 돌려 썼다(원본과 다름).
 */
const BATTING_ORDER_SIZE = 9

/** 팀 투수 여덟 칸 (`team+0x0c`) — 벤치는 여기서 마운드와 이미 쓴 투수를 뺀 나머지다 */
const ALL_PITCHER_SLOTS: readonly number[] = Array.from({ length: PITCHERS_PER_TEAM }, (_, slot) => slot)

/**
 * 명단 밖에서 들어온 **마타자**의 로스터 칸 표시 — 리그 붙박이 표(0~11)에 없는 선수다 (`0x1f84c` 저장 레코드).
 * 선수 기록표(`leaguePlayerStats`)에는 쌓지 않는다 (아래 `simulateLeagueGame` 주석).
 */
export const ACE_BATTER_ROSTER_SLOT = BATTERS_PER_TEAM
/** **마투수**가 앉는 투수 명단 칸 — `0xb521c` 의 `0x60` 가지가 8번 칸(로스터 여덟 뒤)에 넣는다 */
export const ACE_PITCHER_SLOT = PITCHERS_PER_TEAM

/** 마타자를 넣는 명단 칸 — `0xb53f0` 의 `0x40` 가지가 9번 = 첫 벤치 칸 */
const ACE_BATTER_ENTRY_SLOT = 9

/** 한 팀이 받는 마선수 번호 둘 (`ACE_BATTERS` · `ACE_PITCHERS` 칸 0~4) */
export interface LeagueGameAces {
  readonly batter: number
  readonly pitcher: number
}

/** `simulateLeagueGame` 의 덧붙임 — 경기 준비가 넣는 것 */
export interface LeagueGameExtras {
  /** 명단(`matchup` 의 away·home)마다 넣을 마선수 — `0xb8870`(마타자)·`0xb88c8`(마투수) */
  readonly aces?: { readonly away?: LeagueGameAces; readonly home?: LeagueGameAces }
  /**
   * 마선수 레벨 열 칸 `mgr[0x13a..0x143]` — 마선수 능력치 네 칸이 `0xb6414` 첫 단계에서 `v · 0xd88aa[레벨] / 100`
   * 을 먹는다(모드를 가리지 않는 전역 칸). 안 넘기면 모두 Lv1(60%) — 새 저장 기본값이다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
}

/** 마투수 하나 — 간이 타석용 능력과 스태미나 용량의 바탕(체력 칸) */
interface LeagueAcePitcher {
  readonly quick: QuickAtBatPitcher
  readonly staminaAbility: number
}

function acePitcherOf(index: number, levels: Readonly<Record<number, number>> | undefined): LeagueAcePitcher | undefined {
  const ace = ACE_PITCHERS[index]
  if (ace === undefined) return undefined
  // 마투수 레코드 +0xc 부터 u16 넷 = 제구·구속·변화·체력 (acePlayers 의 hit·power·defense·run 칸 차례)
  const ability = aceAbilityAtLevel(ace.ability, aceLevelOf(levels, aceLevelSlotOf('투수', index + 1)))
  return {
    quick: { control: ability.hit, velocity: ability.power, stamina: ability.run, skillIds: [] },
    staminaAbility: ability.run,
  }
}

function aceBatterOf(index: number, levels: Readonly<Record<number, number>> | undefined): QuickAtBatBatter | undefined {
  const ace = ACE_BATTERS[index]
  if (ace === undefined) return undefined
  const ability = aceAbilityAtLevel(ace.ability, aceLevelOf(levels, aceLevelSlotOf('타자', index + 1)))
  return { hit: ability.hit, power: ability.power, run: ability.run, skillIds: [] }
}

/**
 * 마타자를 넣은 명단 — `0xb53f0` 은 9번(첫 벤치)에 넣으며 **옛 9번을 맨 끝으로 옮긴다**(b544a, 밀기가 아니다).
 * 벤치 타자 수 `team+0x28c` 가 하나 는다(0xb8870 b8898~b88b2) — CPU 대타 `rand(0, 벤치 수)` 의 범위가 3 → 4 다.
 */
function withAceBatterLineup(lineup: QuickLineup): QuickLineup {
  const rosterSlots = [...lineup.rosterSlots]
  const records = [...lineup.records]
  const seated = rosterSlots[ACE_BATTER_ENTRY_SLOT]
  if (seated !== undefined) {
    rosterSlots.push(seated)
    records.push(records[ACE_BATTER_ENTRY_SLOT] ?? EMPTY_BATTER_GAME_RECORD)
  }
  rosterSlots[ACE_BATTER_ENTRY_SLOT] = ACE_BATTER_ROSTER_SLOT
  records[ACE_BATTER_ENTRY_SLOT] = EMPTY_BATTER_GAME_RECORD
  return { rosterSlots, records, benchBatters: lineup.benchBatters + 1 }
}

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
  const stadium = Math.trunc(random.nextInRange(0, 4))
  const x = Math.trunc(random.nextInRange(0, 5))
  const y = Math.trunc(random.nextInRange(0, 5))
  const pitcherB = rollOpponentAceIndex(y, random)
  const batterB = rollOpponentAceIndex(x, random)
  return { stadium, teamA: { batter: x, pitcher: y }, teamB: { batter: batterB, pitcher: pitcherB } }
}

/**
 * 굴림을 명단 쪽(`cpuGameSidesOf` 의 away·home)으로 — 팀 A 는 **칸 sX 의 객체**다.
 * `sideOfX` 가 홈(1)이면 A 는 말 공격 명단, 원정(0)이면 초 공격 명단이다.
 */
export function cpuGameAcesOf(
  rolls: CpuGamePrepRolls,
  sideOfX: number = LEAGUE_SIDE_HOME,
): NonNullable<LeagueGameExtras['aces']> {
  return sideOfX === LEAGUE_SIDE_HOME
    ? { away: rolls.teamB, home: rolls.teamA }
    : { away: rolls.teamA, home: rolls.teamB }
}

/**
 * 한 팀의 수비 쪽 재료 (`HalfInningDefense`) — 반 이닝마다 리드와 마운드만 갈아 끼운다.
 *
 * `bothTeamsAreCpu` 는 **참**이다: 하루치 리그 경기는 양 팀 다 CPU 조작이라 마무리 투입 굴림
 * 0xac360 이 첫 줄에서 0 을 돌려준다 (`state[0x31+0]==1 && state[0x31+1]==1`, 0xb6c20).
 * 그래서 리그 경기의 새 투수는 **늘 0xabfcc** 로 고른다.
 */
function defenseOf(
  teamId: number,
  mound: HalfInningMound,
  lead: number,
  staminas: readonly number[],
  acePitcher?: LeagueAcePitcher,
): HalfInningDefense {
  const roster = teamPitchers(teamId)
  return {
    mound,
    // 마투수는 명단 8번 칸 = 벤치 맨 끝에 하나 더 (0xb88c8 → 0xb521c, 벤치 투수 수 team+0x33 +1)
    pitcherSlots: acePitcher === undefined ? ALL_PITCHER_SLOTS : [...ALL_PITCHER_SLOTS, ACE_PITCHER_SLOT],
    pitcherAt: (slot) =>
      slot === ACE_PITCHER_SLOT && acePitcher !== undefined
        ? acePitcher.quick
        : quickPitcherOf(roster[slot % roster.length]),
    // 투수 능력치 순서는 제구·구속·변화·**체력** (칸 3)
    staminaAbilityAt: (slot) =>
      slot === ACE_PITCHER_SLOT && acePitcher !== undefined
        ? acePitcher.staminaAbility
        : roster[slot % roster.length].ability[3],
    // 벤치 투수는 제 레코드 값으로 올라온다 — 경기 사이에 이어진 값
    staminaAt: (slot) => staminas[slot] ?? FULL_STAMINA,
    lead,
    bothTeamsAreCpu: true,
  }
}

/**
 * 한 경기를 9이닝(동점이면 연장)까지 돌린다.
 *
 * `matchup` 은 **명단**으로 본 두 팀이다 — `away` 의 선수가 초(칸 0), `home` 의 선수가 말(칸 1)에 공격한다.
 * CPU 끼리 경기 준비는 칸의 팀 번호와 명단이 엇갈리므로 부르는 쪽이 `cpuGameSidesOf` 로 바꿔 넘긴다.
 *
 * `startingPitcherSlot` 을 주면 **양 팀 모두 그 칸**이 선발이다 — 정규 리그와 포스트시즌(0xc2760)은 같은 준비
 * `0xc239c` 의 4인 로테이션(`0xb8c80` → `0xb5ca8`, 포스트시즌은 시리즈 안 경기 수가 g), 국가대항전은 준비
 * `0xc2c4c` 가 `L+0x32 % 4` 로 0↔k 맞바꿈(`0xb6c34` → `0xb8c94`)을 한다. CPU 끼리 경기에 `rand(0,4)` 선발은 없다.
 * 안 주면 `rand(0,4)` 두 번으로 뽑는다 — 지금은 이 길을 쓰는 원본 CPU 경기가 없다(테스트·예비용).
 *
 * **마선수** — `0xc239c` 는 두 팀 객체를 만든 직후 굴림 다섯(`rollCpuGamePrep`)으로 양 팀에 마타자·마투수를 하나씩
 * 넣는다(정규·포스트시즌 모두). `extras.aces` 로 받아 마타자는 첫 벤치(9번, 옛 9번은 맨 끝), 마투수는 투수 명단 8번
 * (벤치 맨 끝)에 앉힌다 — 선발이 아니라 **CPU 대타·CPU 투수 교체로만** 경기에 나온다. 능력치 네 칸은 레벨 배율
 * `0xd88aa` 을 먹는다(`extras.aceLevels`). 국가대항전 준비 `0xc2c4c` 에는 이 굴림이 없다(`state+0x30 = 0xff`).
 * ⚠️ 남은 차이:
 *   - 마투수 스태미나 시작 값 — 원본은 저장의 마투수 레코드(`0x1f824`) +0x2c 를 통째로 복사한다. 그 값을 못 읽어
 *     10000 으로 선다 (`features/play-team-game` 의 마투수와 같은 근사).
 *   - CPU 대타 판정 `0xac228` 은 타석의 타자가 마선수(`0xb633c`)면 대타를 안 낸다. 그 검사가 웹 `tryQuickCpuPinchHit`
 *     (`entities/game/model/quickLineup`)에 `batterIsAce: false` 로 박혀 있어, 대타로 들어선 마타자가 다시 대타로
 *     바뀔 수 있다 — 그 파일 몫이다.
 *   - 원본은 마선수를 팀 **저장 레코드**에 넣는다(0xb53f0·0xb521c 가 0xb8680 의 레코드를 늘리고 덮는다) — 첫 경기 뒤로
 *     팀 레코드에 마선수 칸이 남아 사람 경기의 명단·기록표에도 비친다. 웹은 경기마다 붙박이 표에서 새로 세운다.
 */
export function simulateLeagueGame(
  matchup: LeagueMatchup,
  random: RandomPort,
  /**
   * 선발 칸 — 수 하나면 양 팀 같은 칸, `{ away, home }` 이면 명단마다 따로(포스트시즌은 앞 시리즈에서 이어 온 칸이
   * 팀마다 달라 `postseasonStarterSlotOf` 가 팀별로 준다).
   */
  startingPitcherSlot?: number | { readonly away: number; readonly home: number },
  /**
   * 두 팀 투수 칸(0~7)별 **시작 스태미나** `+0x2c` — 정규시즌은 첫날만 10000(`0xb6190`)이고 그 뒤로는 경기에서
   * 깎인 값에 하루 끝 `0xb617c` +20% 만 더한 값이다 (a583fe0). 안 넘기면 모두 10000.
   */
  startingStaminas?: { readonly away?: readonly number[]; readonly home?: readonly number[] },
  /** 경기 준비가 넣는 마선수 (`0xc239c` → `rollCpuGamePrep`·`cpuGameAcesOf`). 안 넘기면 없다 */
  extras?: LeagueGameExtras,
): LeagueGameScore {
  const levels = extras?.aceLevels
  const awayAces = extras?.aces?.away
  const homeAces = extras?.aces?.home
  const awayAceBatter = awayAces === undefined ? undefined : aceBatterOf(awayAces.batter, levels)
  const homeAceBatter = homeAces === undefined ? undefined : aceBatterOf(homeAces.batter, levels)
  const awayAcePitcher = awayAces === undefined ? undefined : acePitcherOf(awayAces.pitcher, levels)
  const homeAcePitcher = homeAces === undefined ? undefined : acePitcherOf(homeAces.pitcher, levels)
  const batterOfTeam = (teamId: number, ace: QuickAtBatBatter | undefined) => (slot: number) =>
    slot === ACE_BATTER_ROSTER_SLOT && ace !== undefined ? ace : batterAt(teamId, slot)
  // 선발은 경기를 세울 때 로스터 앞 4명 중 하나로 정해진다 (0x3107a·0x31090, S13 1-4b)
  // 칸 번호를 먼저 정해 두는 것은 **투수 기록을 그 칸에 쌓아야** 하기 때문이다.
  // 난수를 부르는 횟수·순서는 예전과 같다(팀마다 한 번씩).
  const awaySlot =
    typeof startingPitcherSlot === 'object' ? startingPitcherSlot.away : startingPitcherSlot ?? rollStartingPitcherIndex(random)
  const homeSlot =
    typeof startingPitcherSlot === 'object' ? startingPitcherSlot.home : startingPitcherSlot ?? rollStartingPitcherIndex(random)
  // 선발 능력은 아래 `defenseOf` 가 마운드 칸으로 다시 집으므로, 이 둘은 수비 쪽을 넘기지 않는
  // 길(포스트시즌 한 경기 등)에서 쓰는 기본값이다
  const awayPitcher = startingPitcherOf(matchup.away, awaySlot)
  const homePitcher = startingPitcherOf(matchup.home, homeSlot)
  let awayRuns = 0
  let homeRuns = 0
  let awayOrder = 0
  let homeOrder = 0
  const plateAppearances: LeaguePlateAppearance[] = []
  /** 반 이닝이 내놓은 타석 결과를 공격 팀 것으로 적어 둔다 — 판정에는 손대지 않는다 */
  const collect = (teamId: number, half: HalfInningResult) => {
    for (const appearance of half.plateAppearances) {
      // ⚠️ 마타자의 타석은 쌓지 않는다 — 원본은 팀 레코드 9번에 복사된 마타자 레코드(0x30 바이트, 기록 칸 +0x20~
      //    포함)에 쌓지만 다음 경기의 0xb8870 이 그 칸을 저장 레코드로 통째로 덮는다. 웹 기록표에는 그 칸이 없다
      if (appearance.rosterSlot === ACE_BATTER_ROSTER_SLOT) continue
      // 선수 기록은 **실제로 선 선수의 로스터 칸**에 쌓는다 — CPU 대타가 들어오면 타순 칸과 갈린다
      plateAppearances.push({
        teamId,
        battingOrderIndex: appearance.rosterSlot ?? appearance.battingOrderIndex % BATTING_ORDER_SIZE,
        outcome: appearance.outcome,
        runsBattedIn: appearance.runsBattedIn,
      })
    }
  }
  /**
   * 투수 쪽 합계 — **투수 칸마다** 한 줄이다. 타석마다 도는 CPU 교체(0xc1ba4 → 0xac428)로
   * 한 경기에 여러 투수가 나올 수 있어, 반 이닝이 내놓는 `pitcherLines` 를 그대로 모은다.
   */
  const pitched = new Map<number, Map<number, { outs: number; runsAllowed: number; strikeouts: number; pitches: number }>>()
  /** 이 반 이닝을 던진 쪽(= 수비 팀)에게 쌓는다 */
  const charge = (defenseTeamId: number, half: HalfInningResult) => {
    const team = pitched.get(defenseTeamId) ?? new Map()
    for (const line of half.pitcherLines) {
      const before = team.get(line.pitcherSlot) ?? { outs: 0, runsAllowed: 0, strikeouts: 0, pitches: 0 }
      team.set(line.pitcherSlot, {
        outs: before.outs + line.outs,
        runsAllowed: before.runsAllowed + line.runsAllowed,
        strikeouts: before.strikeouts + line.strikeouts,
        pitches: before.pitches + line.pitches,
      })
    }
    pitched.set(defenseTeamId, team)
  }

  const awayStaminas = staminaTableOf(startingStaminas?.away)
  const homeStaminas = staminaTableOf(startingStaminas?.home)
  let awayMound = startingMoundOf(awaySlot, awayStaminas[awaySlot])
  let homeMound = startingMoundOf(homeSlot, homeStaminas[homeSlot])
  /**
   * 양 팀 명단(`team+0xe`) — 간이 엔진 `0xc1ba4` 가 타석마다 먼저 공격 팀을 두고 **CPU 대타**
   * `0xac228` 을 부른다 (`0xc1c50`, Q1 4절). 막음 칸 `state[0xe]` 는 두 팀 공용 한 칸이지만 **공마다** 내려가므로
   * (`0xa5e14` a5e7c — 간이 엔진은 `0xc262c` 의 c26ca) 대타는 한 경기에 여러 번 나올 수 있다 — 반 이닝 엔진이
   * 다음 반 이닝에 넘겨 주는 값은 늘 거짓이다.
   */
  // 마타자는 첫 벤치 칸(9번)에 앉는다 — 원본에서 마타자가 타석에 서는 길은 CPU 대타뿐이다
  let awayLineup = awayAceBatter === undefined ? rosterLineupOf(BATTERS_PER_TEAM) : withAceBatterLineup(rosterLineupOf(BATTERS_PER_TEAM))
  let homeLineup = homeAceBatter === undefined ? rosterLineupOf(BATTERS_PER_TEAM) : withAceBatterLineup(rosterLineupOf(BATTERS_PER_TEAM))
  const awayBatterOf = batterOfTeam(matchup.away, awayAceBatter)
  const homeBatterOf = batterOfTeam(matchup.home, homeAceBatter)
  let pinchHitUsed = false
  let steals = 0
  let pinchHits = 0

  for (let inning = 1; inning <= MAXIMUM_INNINGS; inning += 1) {
    const top = simulateHalfInning(
      awayOrder,
      (order) => batterAt(matchup.away, order % BATTING_ORDER_SIZE),
      homePitcher,
      inning,
      random,
      undefined,
      undefined,
      defenseOf(matchup.home, homeMound, homeRuns - awayRuns, homeStaminas, homeAcePitcher),
      { lineup: awayLineup, batterOf: awayBatterOf, pinchHitUsed },
    )
    awayRuns += top.runs
    awayOrder = top.nextBattingOrderIndex % BATTING_ORDER_SIZE
    chargeStaminas(homeStaminas, top, top.mound)
    homeMound = top.mound ?? homeMound
    awayLineup = top.lineup ?? awayLineup
    pinchHitUsed = top.pinchHitUsed ?? pinchHitUsed
    steals += top.steals
    pinchHits += top.pinchHits.length
    collect(matchup.away, top)
    charge(matchup.home, top)

    // 홈이 이미 앞서 있으면 9회말은 치르지 않는다
    if (inning >= REGULAR_INNINGS && homeRuns > awayRuns) break

    const bottom = simulateHalfInning(
      homeOrder,
      (order) => batterAt(matchup.home, order % BATTING_ORDER_SIZE),
      awayPitcher,
      inning,
      random,
      undefined,
      undefined,
      defenseOf(matchup.away, awayMound, awayRuns - homeRuns, awayStaminas, awayAcePitcher),
      { lineup: homeLineup, batterOf: homeBatterOf, pinchHitUsed },
    )
    homeRuns += bottom.runs
    homeOrder = bottom.nextBattingOrderIndex % BATTING_ORDER_SIZE
    chargeStaminas(awayStaminas, bottom, bottom.mound)
    awayMound = bottom.mound ?? awayMound
    homeLineup = bottom.lineup ?? homeLineup
    pinchHitUsed = bottom.pinchHitUsed ?? pinchHitUsed
    steals += bottom.steals
    pinchHits += bottom.pinchHits.length
    collect(matchup.home, bottom)
    charge(matchup.away, bottom)

    if (inning >= REGULAR_INNINGS && awayRuns !== homeRuns) break
  }

  /**
   * 승패 투수 — **근사다**. 원본 규칙(0xa7de8 이 읽는 `state+0x44/0x48`·`+0x50/0x54` 를 누가
   * 채우는가)은 해독 문서가 "미해결" 로 남겨 두었다 (P1 6절 마지막 줄). 여기서는 **이긴 팀
   * 선발에게 승, 진 팀 선발에게 패**로 두고, 구원으로 올라온 투수는 `null` 이다.
   *
   * ⚠️ **세이브(+0x24)는 여전히 늘 0 이다 — 그게 원본이다.** 세이브 종류 코드 `state+0x64` 를
   * 0 으로 되돌리는 코드가 없어 경기 끝 검사(0xa7eaa)에 늘 걸린다: **원본에서도 세이브가 한 번도
   * 기록되지 않는다** (CORRECTIONS 2-1, S1 유력). 구원 교체가 생겼다고 세이브를 지어내지 않는다.
   *
   * 판정은 **실제 점수**로 한다. 아래 `playLeagueDay` 가 옮겨 온 원본 버그(0xc2a48 이 순위표에
   * 진 팀을 승으로 적는 것)는 **순위표 기록 쪽 실수**이고, 원본에서도 승패 투수는 경기 안에서
   * 정해진 진짜 결과를 본다 — 그래서 여기서는 뒤집지 않는다.
   * 동점(웹 안전망인 30이닝까지 안 갈린 경우)은 순위표와 같이 원정 쪽을 승으로 본다.
   */
  const awayWon = awayRuns >= homeRuns
  const linesOf = (teamId: number, starterSlot: number, decision: '승' | '패') =>
    [...(pitched.get(teamId) ?? new Map()).entries()]
      // 마투수 줄은 쌓지 않는다 — 마타자와 같이 팀 레코드 8번 칸이 다음 경기에 저장 레코드로 덮인다
      .filter(([pitcherSlot]) => pitcherSlot !== ACE_PITCHER_SLOT)
      .map(([pitcherSlot, line]) => ({
      teamId,
      pitcherSlot,
      ...line,
      decision: pitcherSlot === starterSlot ? decision : null,
    }))
  const pitcherAppearances: readonly LeaguePitcherAppearance[] = [
    ...linesOf(matchup.away, awaySlot, awayWon ? '승' : '패'),
    ...linesOf(matchup.home, homeSlot, awayWon ? '패' : '승'),
  ]

  return {
    awayRuns,
    homeRuns,
    plateAppearances,
    pitcherAppearances,
    steals,
    pinchHits,
    // 마투수 칸(8번)의 스태미나는 잇지 않는다 — 다음 경기의 0xb88c8 이 저장 레코드(+0x2c 포함)로 다시 덮는다
    pitcherStaminas: {
      away: awayStaminas.slice(0, PITCHERS_PER_TEAM),
      home: homeStaminas.slice(0, PITCHERS_PER_TEAM),
    },
  }
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

/** 하루치 경기가 남긴 것 — 순위표와 **선수 기록표** 두 벌이다 */
export interface LeagueDayResult {
  readonly league: League
  readonly playerStats: LeaguePlayerStats
  /**
   * 팀 번호 → 투수 칸(0~7)별 스태미나 — 넘긴 표에 오늘 치른 CPU 끼리 경기의 소모를 먹인 것(안 치른 팀은 그대로,
   * 표에 없던 팀은 10000 에서 시작). 하루 끝 회복(`0xb617c` +20%)은 아직 안 건 값이다.
   */
  readonly pitcherStaminas: Readonly<Record<number, readonly number[]>>
}

/**
 * 하루치 경기를 리그 전적에 넣는다. `myTeamId` 가 낀 경기는 사람이 직접 치르므로 건너뛴다.
 * 원본에 무승부가 없어 어느 한쪽이 반드시 승이 되고, 점수를 더 낸 **명단**의 팀이 이긴다 — 칸과 명단이 엇갈려
 * 원정 팀 선수가 말 공격을 한다 (`cpuGameSidesOf`, 아래 주석).
 *
 * 원본은 이 경기들도 사람 경기와 같은 기록 함수 0xa8024 를 부르므로 **선수별 성적이 함께 쌓인다**
 * (B-2 확정). 그래서 `playerStats` 를 받아 쌓은 것을 돌려준다 — 이 표가 개인 타이틀·MVP·
 * 연봉협상 등급의 유일한 재료다. 안 넘기면 빈 표에서 시작한다.
 */
export function playLeagueDay(
  league: League,
  day: number,
  myTeamId: number,
  random: RandomPort,
  playerStats: LeaguePlayerStats = EMPTY_LEAGUE_PLAYER_STATS,
  /** 팀 번호 → 투수 칸별 시작 스태미나 (`simulateLeagueGame` 의 `startingStaminas`). 안 넘기면 모두 10000 */
  pitcherStaminas: Readonly<Record<number, readonly number[]>> = {},
  /**
   * 마선수 레벨 열 칸 `mgr[0x13a..0x143]` — CPU 끼리 경기에 들어가는 마선수의 능력치 배율 `0xd88aa`.
   * ⚠️ 안 넘기면 모두 Lv1(60%) — 커리어 모드들(투수편·타자편)은 아직 이 값을 안 넘긴다(미해결).
   */
  aceLevels?: Readonly<Record<number, number>>,
): LeagueDayResult {
  const plateAppearances: LeaguePlateAppearance[] = []
  const pitcherAppearances: LeaguePitcherAppearance[] = []
  const staminas: Record<number, readonly number[]> = { ...pitcherStaminas }
  const played = matchupsOf(day).reduce((current, matchup) => {
    if (matchup.away === myTeamId || matchup.home === myTeamId) return current
    // ⚠️ 칸과 명단이 엇갈린다 (0xc239c, 직접 떴다 — `cpuGameSidesOf` 주석): 홈 팀(A목록 X)의 **선수**가 칸 0
    //    (초 공격)에, 원정 팀(Y)의 선수가 칸 1(말 공격)에 선다. 그래서 X 명단을 먼저 공격으로 돌린다.
    const sides = cpuGameSidesOf(matchup.home, matchup.away)
    // 경기 준비의 굴림 다섯 — 구장 · 양 팀 마타자·마투수 (c2464~c24ea). 팀 A = 칸 1(X = 홈)의 객체 = 원정 명단
    const rolls = rollCpuGamePrep(random)
    // 하루가 끝날 때마다 팀마다 로테이션이 한 칸 돈다 (0xb5ca8, S5 U-16) — 날짜가 선발을 정한다
    const score = simulateLeagueGame(
      sides,
      random,
      rotationSlotOf(day),
      { away: staminas[sides.away], home: staminas[sides.home] },
      { aces: cpuGameAcesOf(rolls), aceLevels },
    )
    staminas[sides.away] = score.pitcherStaminas.away
    staminas[sides.home] = score.pitcherStaminas.home
    plateAppearances.push(...score.plateAppearances)
    pitcherAppearances.push(...score.pitcherAppearances)
    // 기록 c2b80~c2bca (R1 항목 3): `score(칸 0) > score(칸 1)` 이면 A(X = 홈)에 승, 아니면 B(Y = 원정)에 승 —
    // 동점이면 원정 승. R1 은 이것을 "진 팀에 승" 으로 읽었지만 칸 0 에서 친 것은 **X 의 선수**라
    // (위 엇갈림) **점수를 더 낸 명단의 팀이 이긴다**. 상대전적도 같은 쪽으로 쌓인다.
    return score.awayRuns > score.homeRuns
      ? recordLeagueResult(current, matchup.home, matchup.away)
      : recordLeagueResult(current, matchup.away, matchup.home)
  }, league)

  return {
    league: played,
    playerStats: recordLeaguePitcherAppearances(
      recordLeaguePlateAppearances(playerStats, plateAppearances),
      pitcherAppearances,
    ),
    pitcherStaminas: staminas,
  }
}
