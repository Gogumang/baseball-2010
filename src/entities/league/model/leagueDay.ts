import {
  LEAGUE_SIDE_HOME,
  LEAGUE_TEAM_COUNT,
  leagueSideOf,
  opponentOf,
  pitcherOrderOf,
  recordLeagueResult,
  rotateLeaguePitchers,
} from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import { simulateHalfInning, startingMoundOf } from '@/entities/game/model/simulateHalfInning'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { isGameOverAt } from '@/entities/game/model/gameState'
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
  quickBatterOf,
  quickPitcherOf,
  rollStartingPitcherIndex,
  startingPitcherOf,
  teamBatters,
  teamPitchers,
} from '@/entities/team/model/teamRoster'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import { cpuGameRotationAdvances, SEASON_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { FULL_STAMINA, abilityAfterFatigue } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherAbilitySumOf, rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { TEAMS } from '@/shared/config/original/teams'
import {
  EMPTY_LEAGUE_PLAYER_STATS,
  leaguePitcherAppearancesOf,
  recordLeaguePitcherAppearances,
  recordLeaguePlateAppearances,
  recordLeagueStolenBases,
} from '@/entities/league/model/leaguePlayerStats'
import {
  EMPTY_DECISION_STATE,
  REGULATION_LAST_INNING_INDEX,
  applyPitcherChange,
  applyRunScored,
  gameEndDecisionOf,
} from '@/entities/game/model/winLossSave'
import type { DecisionState, PitcherOfRecord } from '@/entities/game/model/winLossSave'
import type {
  LeaguePitcherAppearance,
  LeaguePlateAppearance,
  LeaguePlayerStats,
  LeagueStolenBase,
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
/*
 * **연장 상한은 없다** (E 3d 확정): CPU 끼리 경기 루프 0xc2760 · 0xc2a48 · 0xc2dac 는 `while (0xc2198(sim, 1))` 뿐이고
 * 0xc2198 은 경기 끝 판정 0xb68fc 가 참이면 멈춘다 — 0xb68fc 는 동점이면 끝을 안 내고, 이닝 넘김 0xb6b6c 에 막는 값이
 * 없으며, 점수판 0xb6988 은 `이닝 mod 9` 로 칸을 돌려 쓴다. 그래서 아래 루프도 점수가 갈릴 때까지 돈다
 * (예전 웹의 30회 안전망 `MAXIMUM_INNINGS` 는 원본에 없어 뺐다). 0xc262c 의 이닝 14 는 상한이 아니라 "15회에 스윙 강제"
 * 였다(`quickAtBat.ts`).
 * 경기 끝은 **타석마다** 본다: 고리 `do 0xc262c(한 타석) while 0xc2198(sim, 1)` 의 0xc2198 머리 c21d6 이 0xb68fc 를 부르고
 * (반 이닝 넘김 0xb6b6c 보다 먼저), 참이면 그 자리에서 고리가 멈춘다 — 말 공격 중의 끝내기(9회 이후 홈이 앞서는 타석)와
 * 콜드(7회 이후 — 말 공격 중 홈 10점 차 · 초 3아웃 뒤 홈 10점 차 · 말 3아웃 뒤 원정 10점 차)가 3아웃을 기다리지 않는다.
 * 반 이닝 엔진에 `endsGame`(= `isGameOverAt`)을 넘겨 타석마다 끊는다.
 */

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
  /** 이 경기에서 나온 도루 수 (0xc1818, E-5) */
  readonly steals: number
  /**
   * 도루로 한 루 간 주자들 (0xc1a42~0xc1a98) — `playLeagueDay` 가 레코드 +0x2c(`LeagueBatterLine.steals`)에 쌓는다.
   * 마타자 칸은 뺀다(0xa56dc 의 마선수 거짓). ⚠️ 주자 신원은 반 이닝 엔진의 근사(`HalfInningStolenBase`)다.
   */
  readonly stolenBases: readonly LeagueStolenBase[]
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
  /**
   * 경기가 끝났을 때 **마투수(팀 레코드 8번 칸)** 의 스태미나 `+0x2c` — 마투수를 넣은 명단만 있다.
   * 원본은 `0xb88c8 → 0xb521c` 가 마투수 레코드를 팀 **저장 레코드** 8번 칸에 0x30 바이트 통째로 복사해 두므로
   * (b5296~b529c memcpy) 경기에서 깎인 값이 그 칸에 남는다. 다음 CPU 경기의 `0xb88c8` 은 다시 저장의 마투수 레코드
   * (`0x1f824`, 늘 10000)로 덮으므로 CPU 경기끼리는 이어지지 않는다 — 남은 값은 그 팀의 **사람 경기**(레코드 8번 칸을
   * 그대로 읽는다)가 볼 값이다.
   */
  readonly acePitcherStaminas: { readonly away?: number; readonly home?: number }
}

/** state 칸 — 초 공격 0 · 말 공격 1 */
const AWAY_SIDE = 0
const HOME_SIDE = 1

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
  /**
   * 두 명단이 **같은 팀 레코드 하나**를 쓴다 — 국가대항전 CPU 경기(`0xc2c4c`)는 대회 중 `0x1f570` 이 팀 10 이 아닌 팀을
   * 모두 상대국 슬롯 `+0x934` 하나로 돌려 두 팀 객체가 같은 선수 레코드를 읽는다. 투수 스태미나 `+0x2c` 가 레코드에
   * 있으므로 **한 표를 두 팀이 같이 깎는다** — 같은 투수가 양쪽 마운드에 서면 한 값을 나눠 쓴다.
   * 팀 객체의 명단 차례(`team[i]`)·교체로 쓴 칸은 팀마다 따로다.
   */
  readonly sharedRoster?: boolean
  /**
   * 명단마다의 **투수 레코드 차례** (`League.pitcherOrders`) — 칸 p 에 앉은 붙박이 표 칸. 0번이 선발이고 나머지가
   * 벤치 차례다(교체 0xabfcc 가 `team+0x0c` 를 이 차례로 훑는다 — 같은 조건이면 앞 칸을 고른다). 안 넘기면 `[0..7]`.
   */
  readonly pitcherOrders?: { readonly away?: readonly number[]; readonly home?: readonly number[] }
  /** 경기용 능력치(0xb570c)의 모드 갈래 — 교체 0xabfcc 마무리 갈래의 능력 합 0xb5b50 에 쓴다. 안 넘기면 모드 2 밖 */
  readonly abilityContext?: LeagueAbilityContext
  /**
   * 명단마다의 **팀 레코드 선수 배열** (`LeagueTeamRecord`) — 트레이드로 바뀐 팀만 넘긴다. 안 넘긴 명단은 붙박이 표 그대로
   * (칸 k = 표 칸 k)다. 투수 차례(`pitcherOrders`)·스태미나 표의 칸은 이 배열의 첨자다.
   */
  readonly records?: { readonly away?: LeagueTeamRecord; readonly home?: LeagueTeamRecord }
}

/**
 * 팀 레코드 한 칸에 앉은 선수의 **붙박이 표 자리** — 원본 선수 레코드의 id(+0)는 Xls 행 번호(투수 `팀 × 8 + 칸` ·
 * 타자 `팀 × 12 + 칸`)라 트레이드(0xd1cc~0xd3ae)로 다른 팀 레코드에 옮겨져도 그대로다. 이름·능력치·구질·보직(+0xb)은
 * 그 행의 사본이고, 성적 칸(+0x20~)도 레코드에 있어 선수를 따라간다 — 리그 선수 기록표는 이 자리(`leagueBatterIdOf` ·
 * `leaguePitcherIdOf`)로 센다.
 */
export interface LeagueRecordPlayer {
  readonly tableTeamId: number
  readonly tableSlot: number
  /**
   * 레코드 +0x19 · +0x1a 장비 니블 네 칸 — 시즌 저장 명단의 값(새 해 CPU 장비 굴림 0x665e8 · `SeasonPlayer.equipment`).
   * 경기는 레코드를 `0xb6414(rec, k, 1)` 로 읽어 니블 보너스를 먹는다(`recordAbilityOf`). 없으면 그 Xls 행의 니블
   */
  readonly equipment?: readonly number[]
}

/**
 * **팀 레코드의 선수 배열** — 시즌 저장 `0x1f570(저장, 팀)` 의 투수 8 · 타자 12. CPU 경기 준비 `0xc239c` 가 세우는 팀 객체
 * `0xb891c` 는 `team[i] = i` 첨자만 들고 선수는 `0xb8680` 이 모드 2·3·4 에서 `팀객체+0x25` 의 팀 번호로 그 레코드에서
 * 꺼낸다(b869e → 0x1f570 — 직접 떴다). 그래서 트레이드로 바뀐 레코드가 그대로 경기에 선다.
 * 투수 배열은 로테이션 전 자리 차례(웹 명단 첨자)다 — 로테이션은 `pitcherOrders` 가 따로 든다.
 */
export interface LeagueTeamRecord {
  readonly batters: readonly LeagueRecordPlayer[]
  readonly pitchers: readonly LeagueRecordPlayer[]
}

/** 레코드 칸 k 의 붙박이 표 자리 — 레코드가 없거나 그 칸이 없으면 그 팀 표 칸 k 그대로 */
function recordPlayerAt(
  record: LeagueTeamRecord | undefined,
  teamId: number,
  isPitcher: boolean,
  slot: number,
): LeagueRecordPlayer {
  const found = (isPitcher ? record?.pitchers : record?.batters)?.[slot]
  return found ?? { tableTeamId: teamId, tableSlot: slot }
}

/** 레코드 칸 k 의 투수 표 줄 (표 행 그대로 — 구질·손을 행 차례로 찾으므로 사본을 만들지 않는다) */
function recordPitcherRowAt(record: LeagueTeamRecord | undefined, teamId: number, slot: number) {
  const at = recordPlayerAt(record, teamId, true, slot)
  const roster = teamPitchers(at.tableTeamId)
  return roster[at.tableSlot % roster.length]
}

/** 레코드 칸 k 의 투수 장비 니블 — 레코드의 것(`LeagueRecordPlayer.equipment`), 없으면 undefined(표 행 니블) */
function recordPitcherEquipmentAt(record: LeagueTeamRecord | undefined, teamId: number, slot: number) {
  return recordPlayerAt(record, teamId, true, slot).equipment
}

/** 레코드 칸 k 의 투수 간이 타석 능력 — 밑값 0xb6414(장비 니블 · 장착 스킬, `quickPitcherOf`) */
function recordQuickPitcherAt(record: LeagueTeamRecord | undefined, teamId: number, slot: number): QuickAtBatPitcher {
  return quickPitcherOf(recordPitcherRowAt(record, teamId, slot), recordPitcherEquipmentAt(record, teamId, slot))
}

/** 레코드 칸 k 의 투수 `0xb6414(rec, k, 1)` 네 칸 — 장비 니블 · 장착 스킬을 먹인 밑값 */
function recordPitcherAbilityAt(record: LeagueTeamRecord | undefined, teamId: number, slot: number): readonly number[] {
  const row = recordPitcherRowAt(record, teamId, slot)
  if (row === undefined) return [0, 0, 0, 0]
  return recordAbilityOf({ ...row, equipment: recordPitcherEquipmentAt(record, teamId, slot) ?? row.equipment }, true)
}

/**
 * CPU 투수의 경기용 능력치(`0xb570c`)가 모드에 따라 먹는 것 — CPU 끼리 경기에는 내 팀이 없으므로 모드 2 의 내 팀 갈래
 * (질병·보직·사기, 0xb581a 가 감쌈)는 오지 않는다. 남는 것은 팀 능력치 0xb592c(모드 1·2·8·9)와 코치 0xb5a74(모드 2)다.
 */
export interface LeagueAbilityContext {
  /** 원본 게임 모드 `0x1552d10` — 시즌 2 · 투수편 3 · 타자편 4 */
  readonly mode: number
  /** 팀 번호 → 팀 능력치 네 칸 [투구, 타격, 집중, 근성] (시즌 기록). 안 넘기면 XlsTEAM_DATA 그대로 */
  readonly teamAbilities?: readonly (readonly number[])[]
  /** 시즌 코치 `SR+0x185` (−1 없음, 0~9). 원본 코치 분기에 팀 검사가 없어 상대 팀에도 붙는다 (J 4-2 유력) */
  readonly coach?: number
}

/** 팀 능력치를 먹이는 모드 비트 0x306 = {1, 2, 8, 9} (0xb593a) */
const TEAM_ABILITY_MODE_MASK = 0x306
/** 코치 표 `0xd884c` — 투수 칸에 붙는 것은 0~4 번 (0xb5a74 점프표) */
const COACH_BONUS: readonly number[] = [8, 9, 10, 6, 4, 8, 5, 10, 6, 7]
/** 코치 번호 → 붙는 투수 칸 (제구 0 · 구속 1 · 변화 2 · 체력 3) */
const COACH_PITCHER_SLOTS: Readonly<Record<number, readonly number[]>> = {
  0: [2],
  1: [1],
  2: [0],
  3: [0, 2],
  4: [0, 1, 2, 3],
}
/** 투수 칸 → 팀 능력치 칸 — 구속·변화 → 투구(0), 제구 → 집중(2), 체력 → 근성(3) (0xb592c) */
const TEAM_ABILITY_SLOT_OF_PITCHER = [2, 0, 0, 3] as const
const XLS_TEAM_ABILITY_OFFSET = 2

/**
 * CPU 투수 한 칸의 경기용 능력치 — `0xb570c(팀, k, P, 1, 90, 1)` 차례: 0xb6414 실효값(`base` — 부르는 쪽이 장비 니블 ·
 * 장착 스킬을 먹여 넘긴다, `recordAbilityOf`) → 피로 0xb58e6
 * (체력 인자 90 이면 없음) → 팀 능력치 정액 0xb592c → 코치 0xb5a74 → 0..999 자르기 0xb5b06.
 * 팀 정액·코치 식은 `features/play-team-game/model/gameAbilities`(J-4 확정)와 같다 — entities 가 features 를 못 불러 옮겨 적었다.
 */
export function cpuPitcherGameAbilityOf(
  base: number,
  slot: number,
  teamId: number,
  context: LeagueAbilityContext | undefined,
): number {
  let value = base
  const mode = context?.mode ?? -1
  if (mode >= 0 && mode <= 9 && ((1 << mode) & TEAM_ABILITY_MODE_MASK) !== 0) {
    const abilities = context?.teamAbilities?.[teamId] ?? TEAMS[teamId]?.values.slice(XLS_TEAM_ABILITY_OFFSET)
    const teamAbility = abilities?.[TEAM_ABILITY_SLOT_OF_PITCHER[slot] ?? 0] ?? 0
    if (teamAbility !== 0) value += Math.trunc((17 * teamAbility - 5100) / 100)
  }
  const coach = context?.coach ?? -1
  if (mode === 2 && coach >= 0 && (COACH_PITCHER_SLOTS[coach]?.includes(slot) ?? false)) value += COACH_BONUS[coach] ?? 0
  return Math.min(999, Math.max(0, value))
}

/** 타자 칸 → 팀 능력치 칸 — 히트·파워 → 타격(1), 수비 → 집중(2), 주루 → 근성(3) (0xb592c) */
const TEAM_ABILITY_SLOT_OF_BATTER = [1, 1, 2, 3] as const
/** 코치 번호 → 붙는 타자 칸 (히트 0 · 파워 1 · 수비 2 · 주루 3) — 점프표 0xd8858 의 5~9 */
const COACH_BATTER_SLOTS: Readonly<Record<number, readonly number[]>> = {
  5: [0],
  6: [2, 3],
  7: [1],
  8: [0, 3],
  9: [0, 1],
}

/**
 * CPU 타자 한 칸의 경기용 능력치 — `cpuPitcherGameAbilityOf` 와 같은 `0xb570c(팀, k, B, 1, 90, 1)` 차례의 타자 쪽.
 * 간이 타석의 스윙 0xab214 가 타자 능력을 이 인자로 읽는다(`0xb570d(…, 1, 0x5a, 1)`, quickAtBat 머리말).
 */
export function cpuBatterGameAbilityOf(
  base: number,
  slot: number,
  teamId: number,
  context: LeagueAbilityContext | undefined,
): number {
  let value = base
  const mode = context?.mode ?? -1
  if (mode >= 0 && mode <= 9 && ((1 << mode) & TEAM_ABILITY_MODE_MASK) !== 0) {
    const abilities = context?.teamAbilities?.[teamId] ?? TEAMS[teamId]?.values.slice(XLS_TEAM_ABILITY_OFFSET)
    const teamAbility = abilities?.[TEAM_ABILITY_SLOT_OF_BATTER[slot] ?? 3] ?? 0
    if (teamAbility !== 0) value += Math.trunc((17 * teamAbility - 5100) / 100)
  }
  const coach = context?.coach ?? -1
  if (mode === 2 && coach >= 0 && (COACH_BATTER_SLOTS[coach]?.includes(slot) ?? false)) value += COACH_BONUS[coach] ?? 0
  return Math.min(999, Math.max(0, value))
}

/** 간이 타석 타자를 경기용 능력치(체력 인자 90)로 — 히트·파워·주루 (`cpuBatterGameAbilityOf`) */
function gameQuickBatterOf(batter: QuickAtBatBatter, teamId: number, context: LeagueAbilityContext | undefined): QuickAtBatBatter {
  return {
    ...batter,
    hit: cpuBatterGameAbilityOf(batter.hit, 0, teamId, context),
    power: cpuBatterGameAbilityOf(batter.power, 1, teamId, context),
    run: cpuBatterGameAbilityOf(batter.run, 3, teamId, context),
  }
}

/**
 * 마투수 레코드의 스태미나 `+0x2c` — 원본은 `0xb521c` 가 저장의 마투수 레코드(`0x1f824` = 앱 데이터 +0xac → +0xc64
 * + 번호×0x30)를 **+0x2c 까지 통째로** 팀 레코드 8번 칸에 복사한다. 그 레코드는 `0x20094` 의 6번 갈래가
 * `data/XlsACE_PIT_DATA.zt1` 의 0x30 바이트 행을 그대로 부어 만들고, 다섯 행 모두 +0x2c = `10 27` = **10000** 이다.
 * `0x1f824` 를 부르는 넷(0x48d50 · 0x5aefc · 0xaae7c · 0xb88c8)은 모두 복사해 가는 쪽이라 이 칸을 고치는 곳이 없다.
 */
export const ACE_PITCHER_RECORD_STAMINA = 10_000

/** 마투수 하나 — 간이 타석용 능력과 스태미나 용량의 바탕(체력 칸), 레코드 스태미나 */
interface LeagueAcePitcher {
  readonly quick: QuickAtBatPitcher
  readonly staminaAbility: number
  /** 변화 칸 (능력 합 0xb5b50 용) */
  readonly breaking: number
  /** 레코드 +0x2c — 마운드에 오를 때 이 값으로 선다 */
  readonly stamina: number
}

function acePitcherOf(index: number, levels: Readonly<Record<number, number>> | undefined): LeagueAcePitcher | undefined {
  const ace = ACE_PITCHERS[index]
  if (ace === undefined) return undefined
  // 마투수 레코드 +0xc 부터 u16 넷 = 제구·구속·변화·체력 (acePlayers 의 hit·power·defense·run 칸 차례)
  const level = aceLevelOf(levels, aceLevelSlotOf('투수', index + 1))
  const ability = aceAbilityAtLevel(ace.ability, level)
  return {
    // 0xb633c 비트6 — 간이 타석 보정 구조체에 구속·제구가 붙는다 (`quickSwingBoostOf`)
    quick: { control: ability.hit, velocity: ability.power, stamina: ability.run, skillIds: [], ace: { order: index, level } },
    staminaAbility: ability.run,
    breaking: ability.defense,
    stamina: ACE_PITCHER_RECORD_STAMINA,
  }
}

function aceBatterOf(index: number, levels: Readonly<Record<number, number>> | undefined): QuickAtBatBatter | undefined {
  const ace = ACE_BATTERS[index]
  if (ace === undefined) return undefined
  const level = aceLevelOf(levels, aceLevelSlotOf('타자', index + 1))
  const ability = aceAbilityAtLevel(ace.ability, level)
  // 0xb633c 비트6 — 간이 타석 보정 구조체에 히트·파워가 붙는다 (`quickSwingBoostOf`)
  return { hit: ability.hit, power: ability.power, run: ability.run, skillIds: [], ace: { order: index, level } }
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
  /** 투수 레코드 차례 — 벤치를 이 차례로 훑는다 (`LeagueGameExtras.pitcherOrders`) */
  order: readonly number[] = ALL_PITCHER_SLOTS,
  abilityContext?: LeagueAbilityContext,
  /** 팀 레코드 선수 배열 — 트레이드로 옮겨 온 투수는 옛 팀 표 행으로 선다 (`LeagueTeamRecord`) */
  record?: LeagueTeamRecord,
): HalfInningDefense {
  const rowAt = (slot: number) => recordPitcherRowAt(record, teamId, slot)
  /** 그 칸 투수의 밑값 간이 능력 (마투수는 레벨 배율을 먹은 레코드 값) */
  const quickAt = (slot: number): QuickAtBatPitcher =>
    slot === ACE_PITCHER_SLOT && acePitcher !== undefined ? acePitcher.quick : recordQuickPitcherAt(record, teamId, slot)
  return {
    mound,
    // 마투수는 명단 8번 칸 = 벤치 맨 끝에 하나 더 (0xb88c8 → 0xb521c, 벤치 투수 수 team+0x33 +1)
    pitcherSlots: acePitcher === undefined ? order : [...order, ACE_PITCHER_SLOT],
    // 간이 타석의 투수 능력은 `0xb570c(…, 1, 90, 1)` — 밑값(0xb6414) 위에 팀 능력치 정액 · 코치를 먹인다
    pitcherAt: (slot) => {
      const quick = quickAt(slot)
      return {
        ...quick,
        control: cpuPitcherGameAbilityOf(quick.control, 0, teamId, abilityContext),
        velocity: cpuPitcherGameAbilityOf(quick.velocity, 1, teamId, abilityContext),
      }
    },
    // 체력%로 부른 `0xb570c` — 피로 0xb58e6 이 팀 정액 · 코치보다 먼저 먹는다 (simulateHalfInning `tiredPitcherAt`)
    tiredPitcherAt: (slot, staminaPercent) => {
      const quick = quickAt(slot)
      return {
        control: cpuPitcherGameAbilityOf(abilityAfterFatigue(quick.control, staminaPercent), 0, teamId, abilityContext),
        velocity: cpuPitcherGameAbilityOf(abilityAfterFatigue(quick.velocity, staminaPercent), 1, teamId, abilityContext),
      }
    },
    // 투수 능력치 순서는 제구·구속·변화·**체력** (칸 3) — 용량 0x66e44 는 `0xb6415(P, 3, 1)` 이라 장비 니블을 먹는다
    staminaAbilityAt: (slot) =>
      slot === ACE_PITCHER_SLOT && acePitcher !== undefined
        ? acePitcher.staminaAbility
        : recordPitcherAbilityAt(record, teamId, slot)[3] ?? 0,
    // 벤치 투수는 제 레코드 값으로 올라온다 — 경기 사이에 이어진 값
    staminaAt: (slot) => staminas[slot] ?? FULL_STAMINA,
    lead,
    bothTeamsAreCpu: true,
    // 보직 `+0xb & 3` — 로스터 투수 표 칸 0~3 선발 · 4~6 중간 · 7 마무리 (0xb6dec). 로테이션 0xb5ca8 은 선발 넷만
    // 섞어 칸의 보직이 그대로다. 마투수(8번)의 보직은 저장 레코드라 모른다 → 선발로 본다(changePitcherIfNeeded).
    // 트레이드로 옮겨 온 투수는 레코드째 와서 제 표 칸의 보직을 든다
    roleAt: (slot) => rosterPitcherRoleOf(slot === ACE_PITCHER_SLOT ? slot : recordPlayerAt(record, teamId, true, slot).tableSlot),
    // 마선수 0xb633c(+0xa 비트6) — 마투수 8번 칸. 마운드면 특수 문턱(ac4f2), 벤치에 있으면 0xb8a8d 가 참이라
    // 마무리 굴림 0xac360 을 지나고(CPU 끼리라 0xb6c20 이 늘 거짓), 0xabfcc 는 고르지 않는다(ac084)
    isSpecialPitcherAt: (slot) => slot === ACE_PITCHER_SLOT && acePitcher !== undefined,
    // 공 하나 소모 0xa5e14 의 비겁자(비트 18) · 끈기(비트 10) — 레코드 +0x14. 마투수 다섯 줄은 두 비트가 모두 0 이다(XlsACE_PIT_DATA 행 바이트 0x14~0x17)
    skillBitsAt: (slot) => (slot === ACE_PITCHER_SLOT && acePitcher !== undefined ? 0 : rowAt(slot).skillBits),
    // 마무리 갈래(ac0be)의 정렬 열쇠 0xb5b50 = 경기용 능력치(체력 인자 90) 네 칸 합. 마투수는 0xabfcc 가 거르므로
    // 그 칸 값은 쓰이지 않는다 — 레벨 배율 먹은 네 칸을 그대로 둔다
    abilitySumAt: (slot) =>
      slot === ACE_PITCHER_SLOT && acePitcher !== undefined
        ? pitcherAbilitySumOf([
            acePitcher.quick.control,
            acePitcher.quick.velocity,
            acePitcher.breaking,
            acePitcher.staminaAbility,
          ])
        : pitcherAbilitySumOf(
            recordPitcherAbilityAt(record, teamId, slot).map((base, k) =>
              cpuPitcherGameAbilityOf(base, k, teamId, abilityContext),
            ),
          ),
  }
}

/**
 * 반 이닝 하나 동안의 승·패·세 판정 (S1 확정) — 간이 엔진은 **한 점마다** 득점 처리 `0xa5c34` 를 부르고
 * (0xc0fb4·0xc1054 가 점수 `0xb6a9d` +1 바로 뒤), 투수가 바뀐 다음 타석 첫머리에 세이브 후보 `0xa60c0` 을 부른다
 * (0xc262c 의 0xc26a2). 반 이닝 엔진은 판정에 손대지 않으므로 그 결과(타석마다 들어온 점수와 그때 마운드,
 * 교체 때의 아웃·주자·점수)를 차례대로 다시 밟는다 — 교체는 그 앞까지 들어온 점수(`runsBefore`) 자리에 끼운다.
 *
 * 측(side)은 state 칸이다 — 초 공격 칸 0, 말 공격 칸 1. 등번호 자리에는 투수 칸을 넣는다(경기 끝에서
 * 세이브 투수 = 승리 투수 비교에만 쓰이고, 세이브는 어차피 원본 버그로 안 붙는다).
 */
export function decisionsAfterHalfInning(
  state: DecisionState,
  half: HalfInningResult,
  situation: {
    /** 0-기준 이닝 `state+0x6b` */
    readonly inningIndex: number
    /** 공격 칸 `state[9]` (초 0 · 말 1) */
    readonly offenseSide: number
    /** 이 반 이닝이 시작될 때 칸별 점수 [칸 0, 칸 1] */
    readonly scoresBefore: readonly [number, number]
    /** 공격 팀 마운드(지금은 덕아웃)에 서 있는 투수 칸 — 이 반 이닝 동안 바뀌지 않는다 */
    readonly offenseMoundSlot: number
    /** 수비 팀이 이 반 이닝을 시작할 때의 마운드 칸 */
    readonly defenseMoundSlot: number
  },
): DecisionState {
  const { inningIndex, offenseSide } = situation
  const defenseSide = 1 - offenseSide
  const scores: [number, number] = [situation.scoresBefore[0], situation.scoresBefore[1]]
  const scoreOf = (side: number) => scores[side] ?? 0
  let defenseMound = situation.defenseMoundSlot
  const moundPitcherOf = (side: number) => (side === offenseSide ? situation.offenseMoundSlot : defenseMound)
  let decision = state
  let runs = 0
  const changes = [...(half.pitcherChanges ?? [])]
  const applyChangesUpTo = (runsSoFar: number) => {
    while (changes.length > 0 && (changes[0]?.runsBefore ?? 0) <= runsSoFar) {
      const change = changes.shift()
      if (change === undefined) break
      defenseMound = change.pitcherSlot
      decision = applyPitcherChange(decision, {
        lastInningIndex: REGULATION_LAST_INNING_INDEX,
        inningIndex,
        outs: change.outs,
        defenseSide,
        offenseSide,
        scoreOf,
        moundPitcherOf,
        runnerCount: change.runnerCount,
      })
    }
  }
  for (const appearance of half.plateAppearances) {
    if (appearance.runsBattedIn <= 0) continue
    applyChangesUpTo(runs)
    if (appearance.pitcherSlot !== undefined) defenseMound = appearance.pitcherSlot
    for (let run = 0; run < appearance.runsBattedIn; run += 1) {
      scores[offenseSide] = (scores[offenseSide] ?? 0) + 1
      runs += 1
      decision = applyRunScored(decision, {
        inningIndex,
        lastInningIndex: REGULATION_LAST_INNING_INDEX,
        offenseSide,
        defenseSide,
        scoreOf,
        moundPitcherOf,
      })
    }
  }
  applyChangesUpTo(Number.POSITIVE_INFINITY)
  return decision
}

/**
 * 한 경기를 9이닝(동점이면 연장)까지 돌린다.
 *
 * `matchup` 은 **명단**으로 본 두 팀이다 — `away` 의 선수가 초(칸 0), `home` 의 선수가 말(칸 1)에 공격한다.
 * CPU 끼리 경기 준비는 칸의 팀 번호와 명단이 엇갈리므로 부르는 쪽이 `cpuGameSidesOf` 로 바꿔 넘긴다.
 *
 * `startingPitcherSlot` 이 선발 칸이다(수 하나면 양 팀 같은 칸) — 정규 리그와 포스트시즌(0xc2760)은 같은 준비
 * `0xc239c` 의 4인 로테이션(`0xb8c80` → `0xb5ca8`, 포스트시즌은 이어 온 칸 + 시리즈 g — `postseasonStarterSlotOf`),
 * 국가대항전은 준비 `0xc2c4c` 의 `L+0x32 % 4` 0↔k 맞바꿈(`0xb6c34` → `0xb8c94`)이 같은 레코드에 두 번 걸려 제자리라
 * 그 레코드의 0번이다(`nationalCupStartingPitcherIndex`). CPU 끼리 경기에 `rand(0,4)` 선발은 없다.
 * 안 주면 `rand(0,4)` 두 번으로 뽑는다 — 지금은 이 길을 쓰는 원본 CPU 경기가 없다(테스트·예비용).
 *
 * **마선수** — `0xc239c` 는 두 팀 객체를 만든 직후 굴림 다섯(`rollCpuGamePrep`)으로 양 팀에 마타자·마투수를 하나씩
 * 넣는다(정규·포스트시즌 모두). `extras.aces` 로 받아 마타자는 첫 벤치(9번, 옛 9번은 맨 끝), 마투수는 투수 명단 8번
 * (벤치 맨 끝)에 앉힌다 — 선발이 아니다. 마타자는 **CPU 대타**(0xac228)로 들어오고, 들어온 뒤로는 다시 대타로 안 바뀐다.
 * 마투수는 58066a1 뒤 CPU 투수 교체의 벤치 고르기 `0xabfcc` 가 마선수를 고르지 않아(ac084) CPU 끼리 경기 마운드에는
 * 거의 안 나온다 — 벤치에 있는 것만으로 0xb8a8d 가 참이 되어 마무리 굴림·벤치 수에 비친다. 능력치 네 칸은 레벨 배율
 * `0xd88aa` 을 먹는다(`extras.aceLevels`). 국가대항전 준비 `0xc2c4c` 에는 이 굴림이 없다(`state+0x30 = 0xff`).
 * 마투수 스태미나는 저장의 마투수 레코드(`0x1f824`) +0x2c 를 통째로 복사한 값(늘 10000, `ACE_PITCHER_RECORD_STAMINA`)
 * 에서 시작하고, 끝 값은 팀 레코드 8번 칸에 남는다(`acePitcherStaminas`).
 * ⚠️ 남은 차이:
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
  const awayRecord = extras?.records?.away
  const homeRecord = extras?.records?.home
  /** 명단의 레코드 칸 k 에 앉은 타자 — 트레이드로 옮겨 온 선수는 옛 팀 표 행이다 (`LeagueTeamRecord`) */
  const recordBatterAt = (teamId: number, record: LeagueTeamRecord | undefined, slot: number) => {
    const at = recordPlayerAt(record, teamId, false, slot)
    // 표 칸을 12 로 돌려 쓰는 것은 `batterAt` 과 같다 — 장비 니블은 레코드의 것(없으면 표 행)
    const roster = teamBatters(at.tableTeamId)
    return quickBatterOf(roster[at.tableSlot % roster.length], at.equipment)
  }
  // 간이 타석의 타자 능력은 `0xb570c(…, 1, 90, 1)` — 밑값 위에 팀 능력치 정액 · 코치 (`cpuBatterGameAbilityOf`)
  const batterOfTeam = (teamId: number, ace: QuickAtBatBatter | undefined, record: LeagueTeamRecord | undefined) =>
    (slot: number) =>
      gameQuickBatterOf(
        slot === ACE_BATTER_ROSTER_SLOT && ace !== undefined ? ace : recordBatterAt(teamId, record, slot),
        teamId,
        extras?.abilityContext,
      )
  // CPU 대타 0xac228 은 타석 타자가 마선수(0xb633c)면 안 낸다 — 대타로 들어선 마타자는 다시 안 바뀐다.
  // 마타자 칸(12)은 마선수를 넣은 명단에만 있다
  const isAceRosterSlot = (slot: number) => slot === ACE_BATTER_ROSTER_SLOT
  // 선발은 경기를 세울 때 로스터 앞 4명 중 하나로 정해진다 (0x3107a·0x31090, S13 1-4b)
  // 칸 번호를 먼저 정해 두는 것은 **투수 기록을 그 칸에 쌓아야** 하기 때문이다.
  // 난수를 부르는 횟수·순서는 예전과 같다(팀마다 한 번씩).
  const awaySlot =
    typeof startingPitcherSlot === 'object' ? startingPitcherSlot.away : startingPitcherSlot ?? rollStartingPitcherIndex(random)
  const homeSlot =
    typeof startingPitcherSlot === 'object' ? startingPitcherSlot.home : startingPitcherSlot ?? rollStartingPitcherIndex(random)
  // 선발 능력은 아래 `defenseOf` 가 마운드 칸으로 다시 집으므로, 이 둘은 수비 쪽을 넘기지 않는
  // 길(포스트시즌 한 경기 등)에서 쓰는 기본값이다
  const awayPitcher = awayRecord === undefined
    ? startingPitcherOf(matchup.away, awaySlot)
    : recordQuickPitcherAt(awayRecord, matchup.away, awaySlot)
  const homePitcher = homeRecord === undefined
    ? startingPitcherOf(matchup.home, homeSlot)
    : recordQuickPitcherAt(homeRecord, matchup.home, homeSlot)
  let awayRuns = 0
  let homeRuns = 0
  let awayOrder = 0
  let homeOrder = 0
  const plateAppearances: LeaguePlateAppearance[] = []
  const stolenBases: LeagueStolenBase[] = []
  /** 반 이닝이 내놓은 타석 결과를 공격 팀 것으로 적어 둔다 — 판정에는 손대지 않는다 */
  const collect = (teamId: number, half: HalfInningResult, record: LeagueTeamRecord | undefined) => {
    for (const appearance of half.plateAppearances) {
      // ⚠️ 마타자의 타석은 쌓지 않는다 — 원본은 팀 레코드 9번에 복사된 마타자 레코드(0x30 바이트, 기록 칸 +0x20~
      //    포함)에 쌓지만 다음 경기의 0xb8870 이 그 칸을 저장 레코드로 통째로 덮는다. 웹 기록표에는 그 칸이 없다
      if (appearance.rosterSlot === ACE_BATTER_ROSTER_SLOT) continue
      // 선수 기록은 **실제로 선 선수의 로스터 칸**에 쌓는다 — CPU 대타가 들어오면 타순 칸과 갈린다.
      // 기록 칸(+0x20~)은 레코드에 있어 선수를 따라가므로 그 칸에 앉은 선수의 붙박이 표 자리로 센다
      const at = recordPlayerAt(record, teamId, false, appearance.rosterSlot ?? appearance.battingOrderIndex % BATTING_ORDER_SIZE)
      plateAppearances.push({
        teamId: at.tableTeamId,
        battingOrderIndex: at.tableSlot,
        outcome: appearance.outcome,
        runsBattedIn: appearance.runsBattedIn,
      })
    }
    // 0xc1a42~0xc1a98 — 도루로 루를 옮긴 주자마다 레코드 +0x2c 를 +1 (0xa56dc 가 마선수를 뺀다)
    for (const steal of half.stolenBases) {
      if (steal.rosterSlot === ACE_BATTER_ROSTER_SLOT) continue
      const at = recordPlayerAt(record, teamId, false, steal.rosterSlot ?? steal.battingOrderIndex % BATTING_ORDER_SIZE)
      stolenBases.push({ teamId: at.tableTeamId, battingOrderIndex: at.tableSlot })
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

  const sharedRoster = extras?.sharedRoster === true
  const awayPitcherOrder = extras?.pitcherOrders?.away ?? ALL_PITCHER_SLOTS
  const homePitcherOrder = sharedRoster ? awayPitcherOrder : extras?.pitcherOrders?.home ?? ALL_PITCHER_SLOTS
  const awayStaminas = staminaTableOf(startingStaminas?.away)
  const homeStaminas = sharedRoster ? awayStaminas : staminaTableOf(startingStaminas?.home)
  // 마투수는 팀 레코드 8번 칸에 레코드째 들어온다 — 그 +0x2c 로 선다 (0xb521c)
  if (awayAcePitcher !== undefined) awayStaminas[ACE_PITCHER_SLOT] = awayAcePitcher.stamina
  if (homeAcePitcher !== undefined) homeStaminas[ACE_PITCHER_SLOT] = homeAcePitcher.stamina
  /** 같은 레코드를 쓰면 마운드 값이 다른 쪽 반 이닝에 깎였을 수 있다 — 표(레코드)의 값으로 다시 선다 */
  const resynced = (mound: HalfInningMound, table: readonly number[]): HalfInningMound =>
    sharedRoster ? { ...mound, stamina: table[mound.pitcherSlot] ?? mound.stamina } : mound
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
  const awayBatterOf = batterOfTeam(matchup.away, awayAceBatter, awayRecord)
  const homeBatterOf = batterOfTeam(matchup.home, homeAceBatter, homeRecord)
  let pinchHitUsed = false
  let steals = 0
  let pinchHits = 0
  /** 승·패·세 칸 `state+0x44..+0x64` — 경기 상태 초기화 0xb6814 가 셋 다 2(없음)로 둔다 */
  let decision: DecisionState = EMPTY_DECISION_STATE

  // 상한 없이 점수가 갈릴 때까지 (0xc2198 → 0xb68fc)
  for (let inning = 1; ; inning += 1) {
    homeMound = resynced(homeMound, homeStaminas)
    const top = simulateHalfInning(
      awayOrder,
      (order) => recordBatterAt(matchup.away, awayRecord, order % BATTING_ORDER_SIZE),
      homePitcher,
      inning,
      random,
      undefined,
      // 0xc2198 c21d6 — 타석마다 경기 끝 판정 0xb68fc
      {
        endsGame: ({ runs, outs }) =>
          isGameOverAt({ inning, half: '초', outs, awayScore: awayRuns + runs, homeScore: homeRuns }),
      },
      defenseOf(matchup.home, homeMound, homeRuns - awayRuns, homeStaminas, homeAcePitcher, homePitcherOrder, extras?.abilityContext, homeRecord),
      { lineup: awayLineup, batterOf: awayBatterOf, pinchHitUsed, isAceRosterSlot },
    )
    decision = decisionsAfterHalfInning(decision, top, {
      inningIndex: inning - 1,
      offenseSide: AWAY_SIDE,
      scoresBefore: [awayRuns, homeRuns],
      offenseMoundSlot: awayMound.pitcherSlot,
      defenseMoundSlot: homeMound.pitcherSlot,
    })
    awayRuns += top.runs
    awayOrder = top.nextBattingOrderIndex % BATTING_ORDER_SIZE
    chargeStaminas(homeStaminas, top, top.mound)
    homeMound = top.mound ?? homeMound
    awayLineup = top.lineup ?? awayLineup
    pinchHitUsed = top.pinchHitUsed ?? pinchHitUsed
    steals += top.steals
    pinchHits += top.pinchHits.length
    collect(matchup.away, top, awayRecord)
    charge(matchup.home, top)

    // 0xb68fc 가 끝을 냈으면(초 3아웃 뒤 — 9회 이후 홈이 앞섬 · 7회 이후 홈 10점 차) 말은 치르지 않는다
    if (top.gameEnded === true) break

    awayMound = resynced(awayMound, awayStaminas)
    const bottom = simulateHalfInning(
      homeOrder,
      (order) => recordBatterAt(matchup.home, homeRecord, order % BATTING_ORDER_SIZE),
      awayPitcher,
      inning,
      random,
      undefined,
      {
        endsGame: ({ runs, outs }) =>
          isGameOverAt({ inning, half: '말', outs, awayScore: awayRuns, homeScore: homeRuns + runs }),
      },
      defenseOf(matchup.away, awayMound, awayRuns - homeRuns, awayStaminas, awayAcePitcher, awayPitcherOrder, extras?.abilityContext, awayRecord),
      { lineup: homeLineup, batterOf: homeBatterOf, pinchHitUsed, isAceRosterSlot },
    )
    decision = decisionsAfterHalfInning(decision, bottom, {
      inningIndex: inning - 1,
      offenseSide: HOME_SIDE,
      scoresBefore: [awayRuns, homeRuns],
      offenseMoundSlot: homeMound.pitcherSlot,
      defenseMoundSlot: awayMound.pitcherSlot,
    })
    homeRuns += bottom.runs
    homeOrder = bottom.nextBattingOrderIndex % BATTING_ORDER_SIZE
    chargeStaminas(awayStaminas, bottom, bottom.mound)
    awayMound = bottom.mound ?? awayMound
    homeLineup = bottom.lineup ?? homeLineup
    pinchHitUsed = bottom.pinchHitUsed ?? pinchHitUsed
    steals += bottom.steals
    pinchHits += bottom.pinchHits.length
    collect(matchup.home, bottom, homeRecord)
    charge(matchup.away, bottom)

    if (bottom.gameEnded === true) break
  }

  /**
   * 승·패·세 투수 — 경기 끝 0xa7de8 이 읽는 칸 그대로다 (S1 확정, 위 `decisionsAfterHalfInning`).
   * 원본 빈틈도 그대로 옮긴다:
   *   - 승리 투수는 **6회(이닝 index ≥ 5) 이후의 득점 때만** 정해진다 — 5회까지만 점수가 나고 그 뒤로 한 점도
   *     안 나면 **승리 투수가 없다**(패전 투수는 이닝 조건이 없어 남는다). 선발 5이닝 요건 같은 진짜 규칙은 없다.
   *   - 세이브는 **한 번도 기록되지 않는다** — 후보는 교체 0xa60c0 이 잡지만 세이브 코드 `state+0x64` 를 0 으로
   *     되돌리는 곳이 없어 0xa7eaa 에 늘 걸린다 (S1 4-1, CORRECTIONS 2-1).
   * 판정은 경기 안의 **실제 점수**로 한다 — 순위표 쪽의 칸·명단 엇갈림(`playLeagueDay`)과는 따로다.
   */
  const ended = gameEndDecisionOf(decision)
  // 투수 줄·판정도 레코드 칸에 앉은 선수의 붙박이 표 자리로 센다 (타자와 같다 — 기록 칸이 선수를 따라간다).
  // 마투수 8번 칸은 표 자리가 없어 그대로 두고 아래에서 건너뛴다
  const teamOfSide = (side: number) => (side === AWAY_SIDE ? matchup.away : matchup.home)
  const tableSeatOf = (teamId: number, pitcherSlot: number): LeagueRecordPlayer =>
    pitcherSlot === ACE_PITCHER_SLOT
      ? { tableTeamId: teamId, tableSlot: pitcherSlot }
      : recordPlayerAt(teamId === matchup.away ? awayRecord : homeRecord, teamId, true, pitcherSlot)
  const recordOf = (record: PitcherOfRecord | null) => {
    if (record === null) return null
    const seat = tableSeatOf(teamOfSide(record.side), record.number)
    return { side: record.side, pitcherSlot: seat.tableSlot, teamId: seat.tableTeamId }
  }
  const lines = [...pitched.entries()].flatMap(([teamId, team]) =>
    [...team.entries()].map(([pitcherSlot, line]) => {
      const seat = tableSeatOf(teamId, pitcherSlot)
      return { ...line, teamId: seat.tableTeamId, pitcherSlot: seat.tableSlot }
    }),
  )
  const pitcherAppearances: readonly LeaguePitcherAppearance[] = leaguePitcherAppearancesOf(
    lines,
    { winner: recordOf(ended.winner), loser: recordOf(ended.loser), save: recordOf(ended.save) },
    // 칸 s 에서 **던진** 팀 — 초(칸 0) 수비는 home, 말(칸 1) 수비는 away. 판정 측은 그 칸의 팀이다
    teamOfSide,
    // 마투수 줄·판정은 쌓지 않는다 — 마타자와 같이 팀 레코드 8번 칸이 다음 경기에 저장 레코드로 덮인다
    (_teamId, pitcherSlot) => pitcherSlot === ACE_PITCHER_SLOT,
  )

  return {
    awayRuns,
    homeRuns,
    plateAppearances,
    stolenBases,
    pitcherAppearances,
    steals,
    pinchHits,
    // 로스터 칸(0~7)만 다음 CPU 경기로 잇는다 — 8번(마투수)은 다음 경기의 0xb88c8 이 저장 레코드(+0x2c 포함)로 다시 덮는다
    pitcherStaminas: {
      away: awayStaminas.slice(0, PITCHERS_PER_TEAM),
      home: homeStaminas.slice(0, PITCHERS_PER_TEAM),
    },
    // 그래도 팀 레코드 8번 칸에는 깎인 값이 남는다 (0xb521c 가 저장 레코드에 넣은 칸)
    acePitcherStaminas: {
      ...(awayAcePitcher === undefined ? {} : { away: awayStaminas[ACE_PITCHER_SLOT] ?? awayAcePitcher.stamina }),
      ...(homeAcePitcher === undefined ? {} : { home: homeStaminas[ACE_PITCHER_SLOT] ?? homeAcePitcher.stamina }),
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

/** 하루 대진 수 — 열 팀이 다섯 경기를 치른다 */
export const LEAGUE_DAY_GAME_COUNT = 5
/** 점수 칸 초기값 — 경기 객체 +8 을 0x50 바이트 −1 로 채운다(c2a6a). 내 경기 줄은 이 값으로 남는다 */
export const LEAGUE_DAY_NO_SCORE = -1

/**
 * 하루 대진·점수표 — 0xc2a48 의 경기 객체 **+8 ~ +0x57 (s32 × 20)** 그대로다 (직접 떴다).
 * ```
 * c2a66  memset(+8, −1, 0x50)
 * c2a7a  팀 t = 0..9, 칸 k = 0..4: t 가 A[k]·B[k] 에 없고 A[k] == −1 이면
 *          0xb7844(L, t) == 1 → A[k] = t, B[k] = 상대 0xb765c(L, t)
 *          그 밖           → B[k] = t, A[k] = 상대
 * c2aee  칸 k = 0..4: A[k]·B[k] 가 내 팀이면 건너뛴다 — 점수 두 칸이 −1 로 남는다
 *          scoreA[k] = 0xb69b0(경기, side(B[k]))   ; c2b8a — 칸 sY(= 0)에서 친 것 = A 명단의 득점
 *          scoreB[k] = 0xb69b0(경기, side(A[k]))   ; c2b9a — 칸 sX(= 1)에서 친 것 = B 명단의 득점
 *          scoreA > scoreB → A 승 · 그 밖 B 승     ; c2ba6
 * c2be0  모드 2 이고 L+0xac(국가대항전)·L+0x34(포스트시즌)가 둘 다 0 이면 memcpy(SR+0x1c0, +8, 0x50)
 * ```
 * A = side 1 = `LeagueMatchup.home`, B = `away` 다 (`matchupsOf` 와 같은 채움 순서).
 * 점수는 **명단 기준**이라 `simulateLeagueGame` 의 칸 점수와 엇갈린다(`cpuGameSidesOf`) — scoreA 가 칸 0(`awayRuns`)이다.
 * 경기 뒤 마무리 판(0xf1 그림 0xb400)이 이 표를 그린다.
 */
export interface LeagueDayBoard {
  /** +8 [5] — side 1(홈) 팀 */
  readonly teamsA: readonly number[]
  /** +0x1c [5] — side 0(원정) 팀 */
  readonly teamsB: readonly number[]
  /** +0x30 [5] — A 명단의 득점. 내 경기 줄은 −1 */
  readonly scoresA: readonly number[]
  /** +0x44 [5] — B 명단의 득점. 내 경기 줄은 −1 */
  readonly scoresB: readonly number[]
}

/** 하루치 경기가 남긴 것 — 순위표와 **선수 기록표** 두 벌이다 */
export interface LeagueDayResult {
  /** 0xc2a48 의 하루 대진·점수표 (`LeagueDayBoard`) — 시즌모드가 SR+0x1c0 에 옮겨 담는다 */
  readonly board: LeagueDayBoard
  readonly league: League
  readonly playerStats: LeaguePlayerStats
  /**
   * 팀 번호 → 투수 칸(0~7)별 스태미나 — 넘긴 표에 오늘 치른 CPU 끼리 경기의 소모를 먹인 것(안 치른 팀은 그대로,
   * 표에 없던 팀은 10000 에서 시작). 하루 끝 회복(`0xb617c` +20%)은 아직 안 건 값이다.
   */
  readonly pitcherStaminas: Readonly<Record<number, readonly number[]>>
  /**
   * 팀 번호 → 오늘 CPU 경기가 끝났을 때 팀 레코드 8번 칸(마투수)의 스태미나 (`LeagueGameScore.acePitcherStaminas`).
   * 그 팀의 다음 **사람 경기**가 8번 칸을 그대로 읽을 때 쓸 값이다 — 다음 CPU 경기는 10000 으로 다시 덮는다.
   */
  readonly acePitcherStaminas: Readonly<Record<number, number>>
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
   * 안 넘기면 모두 Lv1(60%). 앱은 시즌모드·커리어(타자편·투수편) 모두 `useAceLevels().levels` 를 넘긴다.
   */
  aceLevels?: Readonly<Record<number, number>>,
  /**
   * 사람 경기 두 팀의 로테이션을 여기서 돌리는가 (기본 참). 원본은 사람 경기 준비 `0x6548`(670e~673e)이 g ≠ 0 이면
   * 상대와 내 팀(타자편·시즌) 레코드를 한 칸씩 돌린다 — 그 준비가 아직 리그 차례(`pitcherOrders`)를 돌리지 않으므로
   * 하루 한 칸이 빠지지 않게 여기서 대신 돌린다. 투수편 내 팀은 원본이 돌리지 않고 0↔k 를 맞바꾼다(0xa4f60) —
   * 사람 경기 쪽이 차례를 직접 다루게 되면 거짓을 넘긴다.
   */
  rotatesHumanGameTeams: boolean = true,
  /** 경기용 능력치의 모드 갈래 (`LeagueAbilityContext`) — 시즌모드는 `{ mode: 2, teamAbilities, coach }`. 안 넘기면 모드 2 밖 */
  abilityContext?: LeagueAbilityContext,
  /**
   * 팀 번호 → 그 팀 레코드의 선수 배열 (`LeagueTeamRecord`) — 시즌모드는 트레이드로 바뀐 CPU 팀(`SeasonSave.cpuRosters`)만
   * 준다. 원본 하루 경기 0xc2a48 → 준비 0xc239c → 팀 객체 0xb891c·0xb8680 이 시즌 저장의 팀 레코드(0x1f570)를 그대로
   * 읽는다. 안 주거나 undefined 면 붙박이 표다.
   */
  recordOf: (teamId: number) => LeagueTeamRecord | undefined = () => undefined,
): LeagueDayResult {
  const plateAppearances: LeaguePlateAppearance[] = []
  const stolenBases: LeagueStolenBase[] = []
  const pitcherAppearances: LeaguePitcherAppearance[] = []
  const matchups = matchupsOf(day)
  const scoresA = matchups.map(() => LEAGUE_DAY_NO_SCORE)
  const scoresB = matchups.map(() => LEAGUE_DAY_NO_SCORE)
  const staminas: Record<number, readonly number[]> = { ...pitcherStaminas }
  const aceStaminas: Record<number, number> = {}
  // 리그 모드(2·3·4)는 g ≠ 0 이면 경기 준비마다 두 팀 레코드가 한 칸 돈다 — 모드 차이는 내 팀 쪽뿐이라 2 로 묻는다
  const rotates = cpuGameRotationAdvances(SEASON_MODE, day)
  const humanGame = matchupsOf(day).find((matchup) => matchup.away === myTeamId || matchup.home === myTeamId)
  const rotated =
    rotates && rotatesHumanGameTeams && humanGame !== undefined
      ? rotateLeaguePitchers(league, [humanGame.away, humanGame.home])
      : league
  const played = matchups.reduce((before, matchup, slot) => {
    if (matchup.away === myTeamId || matchup.home === myTeamId) return before
    // ⚠️ 칸과 명단이 엇갈린다 (0xc239c, 직접 떴다 — `cpuGameSidesOf` 주석): 홈 팀(A목록 X)의 **선수**가 칸 0
    //    (초 공격)에, 원정 팀(Y)의 선수가 칸 1(말 공격)에 선다. 그래서 X 명단을 먼저 공격으로 돌린다.
    const sides = cpuGameSidesOf(matchup.home, matchup.away)
    // c2b54 — 경기마다 간이 시뮬 초기화 0xc0dac 의 rand(0, 2) 가 준비 0xc239c(c2b66)보다 먼저다
    rollSimulatorInit(random)
    // 경기 준비의 굴림 다섯 — 구장 · 양 팀 마타자·마투수 (c2464~c24ea). 팀 A = 칸 1(X = 홈)의 객체 = 원정 명단
    const rolls = rollCpuGamePrep(random)
    // 굴림 뒤 c24fc~c254e: g ≠ 0 이면 두 팀 레코드를 0xb5ca8 로 한 칸 돌린다(영구) — 0번 레코드가 오늘의 선발이다
    const current = rotates ? rotateLeaguePitchers(before, [sides.away, sides.home]) : before
    const orders = { away: pitcherOrderOf(current, sides.away), home: pitcherOrderOf(current, sides.home) }
    const score = simulateLeagueGame(
      sides,
      random,
      { away: orders.away[0] ?? 0, home: orders.home[0] ?? 0 },
      { away: staminas[sides.away], home: staminas[sides.home] },
      {
        aces: cpuGameAcesOf(rolls),
        aceLevels,
        pitcherOrders: orders,
        abilityContext,
        records: { away: recordOf(sides.away), home: recordOf(sides.home) },
      },
    )
    staminas[sides.away] = score.pitcherStaminas.away
    staminas[sides.home] = score.pitcherStaminas.home
    if (score.acePitcherStaminas.away !== undefined) aceStaminas[sides.away] = score.acePitcherStaminas.away
    if (score.acePitcherStaminas.home !== undefined) aceStaminas[sides.home] = score.acePitcherStaminas.home
    plateAppearances.push(...score.plateAppearances)
    stolenBases.push(...score.stolenBases)
    pitcherAppearances.push(...score.pitcherAppearances)
    // 점수표 c2b8a·c2b9a — A(홈) 명단이 친 칸 0 점수가 scoreA 다 (`LeagueDayBoard` 주석)
    scoresA[slot] = score.awayRuns
    scoresB[slot] = score.homeRuns
    // 기록 c2b80~c2bca (R1 항목 3): `score(칸 0) > score(칸 1)` 이면 A(X = 홈)에 승, 아니면 B(Y = 원정)에 승 —
    // 동점이면 원정 승. R1 은 이것을 "진 팀에 승" 으로 읽었지만 칸 0 에서 친 것은 **X 의 선수**라
    // (위 엇갈림) **점수를 더 낸 명단의 팀이 이긴다**. 상대전적도 같은 쪽으로 쌓인다.
    return score.awayRuns > score.homeRuns
      ? recordLeagueResult(current, matchup.home, matchup.away)
      : recordLeagueResult(current, matchup.away, matchup.home)
  }, rotated)

  return {
    board: {
      teamsA: matchups.map((matchup) => matchup.home),
      teamsB: matchups.map((matchup) => matchup.away),
      scoresA,
      scoresB,
    },
    league: played,
    playerStats: recordLeaguePitcherAppearances(
      recordLeagueStolenBases(recordLeaguePlateAppearances(playerStats, plateAppearances), stolenBases),
      pitcherAppearances,
    ),
    pitcherStaminas: staminas,
    acePitcherStaminas: aceStaminas,
  }
}
