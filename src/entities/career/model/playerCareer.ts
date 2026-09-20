import type { BatterAbility } from '@/entities/batting/model/batter'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { League } from '@/entities/league/model/league'
import { BALANCE } from '@/shared/config/original/balance'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { finishRegularSeason } from '@/entities/league/model/seasonEnd'
import { runCpuPostseason } from '@/entities/league/model/postseasonPlay'
import { EMPTY_LEAGUE, advancePostseason, opponentOf, recordLeagueResult } from '@/entities/league/model/league'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import {
  EMPTY_LEAGUE_PLAYER_STATS,
  recordLeaguePlateAppearances,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import {
  EMPTY_SEASON_STATS,
  mergeStats,
  recordGamePlayed,
} from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'

/** 원본 능력치 상한 (0xb6414 가 999 로 자른다) */
export const MAXIMUM_ABILITY = BALANCE.ability.maximum
const MAXIMUM_AFFECTION = BALANCE.limits.affection

/**
 * 관리 메뉴가 열리는 주기.
 * 원작 설명서 원문: "2경기마다 관리 메뉴가 발생하며 다음 커맨드로 선수를 육성합니다."
 * (StrHOWTO[11], r_event_txt[172])
 */
export const GAMES_PER_MANAGEMENT_CYCLE = BALANCE.season.gamesPerManagementCycle

/** 한 시즌 경기 수. 원작 설명서 StrHOWTO[10]: "1년에 총 45경기의 정규리그를 진행하며" */
export const GAMES_PER_SEASON = BALANCE.season.gamesPerSeason

/** 경기를 치르면 회복하는 체력 */

export interface PlayerCareer {
  readonly name: string
  readonly ability: BatterAbility
  readonly gamePoint: number
  readonly season: number
  readonly gamesPlayed: number
  readonly stats: SeasonStats
  readonly careerStats: SeasonStats
  /** 마선수 아이디 → 호감도 (0~100) */
  readonly affection: Readonly<Record<string, number>>
  readonly titleIds: readonly string[]
  /** 이글아이 아이템이 남아 있는 경기 수. 0이면 투구 도착 지점이 보이지 않는다. */
  readonly eagleEyeGamesRemaining: number
  readonly seenEventIds: readonly string[]
  /** 원본 스토리에서 다음에 볼 장면 번호 */
  readonly storySceneIndex: number
  /** 소속 팀 (원본 TEAMS 인덱스) */
  readonly teamId: number
  /** 훈련 항목별 누적 횟수. 원작의 "%d/%d회 훈련" 표시를 위한 것. */
  readonly trainingCounts: Readonly<Record<string, number>>
  /**
   * 새 시즌이 시작할 때 떠 둔 통산 훈련 수 사본 (+0x6b+i).
   * 통산에서 이걸 빼면 **이번 시즌 훈련 수**가 된다 — 스킬 획득 조건이 그 값을 본다 (A-4).
   */
  readonly seasonStartTrainingCounts: Readonly<Record<string, number>>
  /**
   * 칸별 **연속** 훈련 수 (+0x70~+0x74). 같은 칸을 훈련하면 오르고,
   * **다른 칸을 훈련하면 전부 0 이 된다** (0x18a80). 스킬 18·19·20 해제 조건이 본다.
   */
  readonly consecutiveTrainingCounts: Readonly<Record<string, number>>
  /** 이번 시즌 인기도 변화 합 (+0x1c2) — 새 시즌에 0 이 된다. 먹튀 획득 조건이 본다 */
  readonly seasonPopularityGain: number
  /** 먹튀(스킬 2)를 가진 뒤의 인기도 변화 합과 경기 수 (+0x1c0 / +0x1cd) — 먹튀 해제 조건이 본다 */
  readonly moneyGrubberPopularityGain: number
  readonly moneyGrubberGames: number
  /** 무력감(스킬 5) 보유 중 "경기 뒤 사기 ≥ 90" 이 **연속**으로 이어진 경기 수 (+0x1c7) */
  readonly highMoraleStreak: number
  /** 몹쓸몸(스킬 3)을 가진 채로 한 훈련 수 (+0x75) — 6회가 되면 해제 조건을 넘는다 */
  readonly badBodyTrainings: number
  /** 유리몸(스킬 4)을 가진 채로 한 훈련 수 (+0x76) — 8회가 되면 해제 조건을 넘는다 */
  readonly fragileTrainings: number
  /** 원작 인기도 — 경기 후 감독 평가와 외출로 변동 */
  readonly popularity: number
  /** 원작 평판 */
  readonly reputation: number
  /** 원작 사기 — 낮으면 부상·질병 확률이 오른다 (StrHOWTO) */
  readonly morale: number
  /** 원작 소지금 (만원 단위). G포인트와는 별개다. */
  readonly money: number
  /**
   * 한 번 해제한 마이너스 스킬 (+0x1d0+k, 표 0xd7e10 = [2,3,4,5,17,18,19,20]).
   * **다시 얻을 수 없다** — 이벤트 조건 20 이 이 플래그를 본다 (A-4).
   */
  readonly removedMinusSkillIds: readonly number[]
  readonly isInjured: boolean
  /** 부상 상태로 치른 경기 수 (+0x1b6) — 20 이 되면 부상 엔딩 0 (0xa3a84) */
  readonly injuredGamesPlayed: number
  readonly isSick: boolean
  /** 걸린 질병 이름 (StrMODE[186]~[189]). 모르면 null */
  readonly illnessName: string | null
  /**
   * 이번 관리 주기에 트레이닝·휴식·외출 중 하나를 이미 했는가.
   * r_event_txt[176] "한번에 트레이닝, 휴식, 외출 중 딱 한 가지 일만 할 수 있으니"
   */
  readonly hasActedThisCycle: boolean
  /** 이번 시즌 외출 횟수 — 칭호 "1년간 외출 2회 이하/20회 이상" (StrNICKNAME[89][90]) */
  readonly outingsThisSeason: number
  /** 한 경기 최다 홈런 — 칭호 "한 경기 홈런 4회 달성" */
  readonly bestHomeRunsInGame: number
  /** 사이클링 히트를 친 경기 수 — 칭호 "사이클링 히트 2회 달성" */
  readonly cycleHitGames: number
  /**
   * 시즌 시작 때 인기도 (선수 +0x78) — 올해의 목표 "인기도 상승" 과 연봉 계산의 기준.
   * 새 시즌 전환이 `S[0x78] = 0xb6e78(S)`(지금 인기도)로 다시 뜬다 (0xa39e0).
   */
  readonly popularityAtSeasonStart: number
  /**
   * 올해의 목표 창을 이미 봤는가 (선수 +0x1b7, 0xa39d0 이 새 시즌마다 0 으로 되돌린다).
   */
  readonly hasSeenYearGoalWindow: boolean
  /**
   * 연초 "올해의 목표" 이벤트(0xd4)를 이미 치렀는가 (선수 +0x1bc 4바이트).
   * 이벤트 조건이 `S+0x1bc == 0 && S+0x187 == 0` 이라, 새 시즌 전환(0x1b882)이 이 칸을 비워
   * **목표 창을 다시 띄우는 스위치**가 된다.
   */
  readonly yearGoalEventDone: boolean
  /** 연봉 (만원 단위, 추정) — 새 시즌 시작 때 소지금에 들어온다 */
  readonly salary: number
  /** 선수 생활이 끝났으면 StrENDING 번호 */
  readonly endingIndex: number | null
  /**
   * 질병 이벤트 쿨다운 (선수 +0x7c). 질병에 걸리거나 나으면 20 이 되고, 0 보다 크면 이벤트 490 이 막힌다.
   * 줄어드는 단위는 미확인이라 경기마다 1 씩 줄인다 (추정).
   */
  readonly illnessCooldown: number
  /** 타순 (1~9). 신인은 9번 (0xa4c2c) */
  /** 배팅 타입 첫 선택 (선수 +0xb 상위 비트) */
  readonly battingTypeIndex: number
  /** 0 내야 · 1 외야 */
  readonly positionIndex: number
  /** 0 우타 · 1 좌타 */
  readonly battingSide: number
  /** 0 황인 · 1 백인 · 2 흑인 */
  readonly skinIndex: number
  /** 가진 서브 아이템 번호 0~9 (선수 +0x58+k) */
  readonly subItemIds: readonly number[]
  /** 질병 남은 기간(+6, 걸리면 3) · 부상 남은 기간(+0x1b5) */
  readonly illnessRemaining: number
  readonly injuryRemaining: number
  /** 장착 레벨 니블 (0 = 미장착, 1~11 = 레벨+1) — 능력치 이름으로 부위를 가리킨다 */
  readonly equipmentLevels: BatterAbility
  /** 산 적 있는 장비 "부위-레벨" */
  readonly ownedEquipment: readonly string[]
  /** 열린 히든 id (원본은 전역 저장 game_o.sav — 앱이 기록연감과 맞춘다) */
  readonly openedHiddenIds: readonly number[]
  /** 리그 전적 (0xb76dc·0xb77e0). 지금은 내 팀 경기만 쌓인다 — 다른 팀 경기는 원본 간이 시뮬레이터를 옮길 때 채운다 */
  readonly league: League
  /**
   * 리그 선수 개인 시즌 성적 (타석 기록 0xa8024). 사람 경기와 CPU 끼리 경기가 **같은 표**에 쌓는다.
   * 개인 타이틀 순위표 0x9d789 · MVP · 연봉협상 등급 k 가 전부 이 표를 본다 (B-2·B-3·B-5).
   * 새 시즌에 0 으로 돌아간다 (0x204e0 — `startNextSeason`).
   */
  readonly leaguePlayerStats: LeaguePlayerStats
  /** 정규시즌 1위 횟수 — 원본 세이브 레코드 +0x7a (0xb818c 가 45경기째에 늘린다) */
  readonly regularSeasonFirstCount: number
  /** 진행 중인 포스트시즌. 정규시즌 중에는 null 이다 (0xb80a8 이 45경기째에 연다) */
  readonly postseason: PostseasonSeries | null
  /** 또또상품권 구매 수(상한 200, +0x186) · 1등 횟수 — 칭호 21·22 */
  readonly lotteryPurchases: number
  readonly lotteryFirstPrizes: number
  /** 필살타법 레벨(+0x201) · 이번 레벨 누적 훈련 횟수(+0x200) */
  readonly specialSwingLevel: number
  readonly specialSwingSessions: number
  readonly battingOrder: number
  /** 목표 타순 경로 — 이벤트 487 에서 고른다. 고르기 전에는 null */
  readonly battingOrderPath: '4번' | '1번' | null
  /** 지난 중간평가 달성 수 (원본 +0x1cc) — 칭호 "전년 대비 성적 우수" */
  readonly lastMidSeasonGoalCount: number
  /** 가진 스킬 번호 (0~39, original/skills). 원본 보유 비트 +0x1b8 */
  readonly skillIds: readonly number[]
  /** 연속 기록 (전역 저장 +0x1bc) — 2안타 이상 경기 · 홈런 경기 · 무안타 경기 */
  readonly streaks: { readonly multiHit: number; readonly homeRun: number; readonly hitless: number }
  readonly wins: number
  readonly draws: number
  readonly losses: number
}

/** 신인의 시작 상태 — 나만의리그 공통 초기화 0x11244~0x11296 */
export const STARTING_POPULARITY = BALANCE.rookie.popularity
export const STARTING_REPUTATION = BALANCE.rookie.reputation
export const STARTING_MORALE = BALANCE.rookie.morale
/** 원본 연봉 50 (0xa4fd8). 원본 단위(100만원) 그대로 둔다 — 화면은 ×100 만원 (관리 화면 0x63118) */
export const STARTING_SALARY = BALANCE.rookie.salary
/** 소지금 단위는 만원이다. 원본은 100만원 단위 60 = 6000만 */
export const STARTING_MONEY = BALANCE.rookie.money
/** 원본 소지금·연봉 한 칸 = 100만원 */
export const ORIGINAL_MONEY_UNIT = BALANCE.money.unit
/** 원본 소지금 상한 9999 칸 (0x1b768) */
const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT
/** 신인 스킬 — 0 병아리 · 8 의외성 (0x11230 에서 a4bd9 두 번) */
const STARTING_SKILL_IDS: readonly number[] = BALANCE.rookie.skillIds

/**
 * 인기도·평판 상한. 원본 칭호 조건에 "평판 999 달성", "인기도 4000이상 달성" 이 있다 (StrNICKNAME[91][71]).
 * 이벤트 보상 점프 표(binary.mod 0xd4e50)도 인기도를 9999, 평판을 999 로 자른다 (점검 에이전트 정적 확인).
 */
export const MAXIMUM_POPULARITY = BALANCE.limits.popularity
export const MAXIMUM_REPUTATION = BALANCE.limits.reputation
export const MAXIMUM_MORALE = BALANCE.limits.morale

/** 기본 소속 팀 — 서울 드래곤즈 */
export const DEFAULT_TEAM_ID = 0

/** 타자 시작 능력치 표 0xcc3fa (배팅 타입 → 히트·파워·수비·주루) */
const ROOKIE_ABILITY_BY_TYPE: readonly BatterAbility[] = BALANCE.ability.rookieByBattingType
/** 생성 화면 둘째 목록이 0 이면 수비, 아니면 주루에 더한다 (0x16e2c) — 목록 뜻은 내야/외야 (추정) */
const ROOKIE_POSITION_BONUS = BALANCE.ability.rookiePositionBonus

export function rookieAbilityOf(battingTypeIndex: number, positionIndex: number): BatterAbility {
  const base = ROOKIE_ABILITY_BY_TYPE[battingTypeIndex] ?? ROOKIE_ABILITY_BY_TYPE[0]
  return positionIndex === 0
    ? { ...base, defense: base.defense + ROOKIE_POSITION_BONUS }
    : { ...base, run: base.run + ROOKIE_POSITION_BONUS }
}

/** 등록 화면 기본 선택(0, 0)의 능력치 */
export const STARTING_ABILITY: BatterAbility = rookieAbilityOf(0, 0)

/** 선수 등록 선택 (0x16f28 — 선수 +0xb: 비트5~7 타입, 비트0~1 내외야, 비트4 손 [추]) */
export interface RookieProfile {
  readonly battingTypeIndex: number
  /** 0 내야 · 1 외야 (StrMODE[4]) */
  readonly positionIndex: number
  /** 0 우타 · 1 좌타 (StrMODE[9], 판정의 side 와 같은 뜻) */
  readonly battingSide: number
  /** 0 황인 · 1 백인 · 2 흑인 (선수 +0xb 비트2~3) */
  readonly skinIndex: number
}

export const DEFAULT_ROOKIE_PROFILE: RookieProfile = { battingTypeIndex: 0, positionIndex: 0, battingSide: 0, skinIndex: 0 }

/** 이름 길이 — 원본은 CP949 바이트로 센다. 한글 2바이트, 영문·숫자 1바이트 (StrMODE[3] "한글 4글자, 영문 8글자") */
export const MAXIMUM_NAME_BYTES = BALANCE.limits.nameBytes

export function nameByteLengthOf(name: string): number {
  return [...name].reduce((total, character) => total + (character.charCodeAt(0) > 0x7f ? 2 : 1), 0)
}
const STARTING_GAME_POINT = BALANCE.rookie.gamePoint

export function createCareer(name: string, profile: RookieProfile = DEFAULT_ROOKIE_PROFILE): PlayerCareer {
  return {
    name,
    ability: rookieAbilityOf(profile.battingTypeIndex, profile.positionIndex),
    gamePoint: STARTING_GAME_POINT,
    season: 1,
    gamesPlayed: 0,
    stats: EMPTY_SEASON_STATS,
    careerStats: EMPTY_SEASON_STATS,
    affection: {},
    titleIds: [],
    eagleEyeGamesRemaining: 0,
    seenEventIds: [],
    storySceneIndex: 0,
    teamId: DEFAULT_TEAM_ID,
    trainingCounts: {},
    seasonStartTrainingCounts: {},
    consecutiveTrainingCounts: {},
    seasonPopularityGain: 0,
    moneyGrubberPopularityGain: 0,
    moneyGrubberGames: 0,
    highMoraleStreak: 0,
    badBodyTrainings: 0,
    fragileTrainings: 0,
    popularity: STARTING_POPULARITY,
    reputation: STARTING_REPUTATION,
    morale: STARTING_MORALE,
    money: STARTING_MONEY,
    removedMinusSkillIds: [],
    isInjured: false,
    injuredGamesPlayed: 0,
    isSick: false,
    illnessName: null,
    hasActedThisCycle: false,
    outingsThisSeason: 0,
    bestHomeRunsInGame: 0,
    cycleHitGames: 0,
    popularityAtSeasonStart: STARTING_POPULARITY,
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    salary: STARTING_SALARY,
    endingIndex: null,
    illnessCooldown: 0,
    battingTypeIndex: profile.battingTypeIndex,
    positionIndex: profile.positionIndex,
    battingSide: profile.battingSide,
    skinIndex: profile.skinIndex,
    subItemIds: [],
    illnessRemaining: 0,
    injuryRemaining: 0,
    equipmentLevels: { hit: 0, power: 0, defense: 0, run: 0 },
    ownedEquipment: [],
    openedHiddenIds: [],
    league: EMPTY_LEAGUE,
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    regularSeasonFirstCount: 0,
    postseason: null,
    lotteryPurchases: 0,
    lotteryFirstPrizes: 0,
    specialSwingLevel: 0,
    specialSwingSessions: 0,
    battingOrder: 9,
    battingOrderPath: null,
    lastMidSeasonGoalCount: 0,
    skillIds: STARTING_SKILL_IDS,
    streaks: { multiHit: 0, homeRun: 0, hitless: 0 },
    wins: 0,
    draws: 0,
    losses: 0,
  }
}

export function trainingCountOf(career: PlayerCareer, menuId: string): number {
  return career.trainingCounts[menuId] ?? 0
}

/**
 * 훈련 한 번을 메뉴별로 센다. 칭호 23(200회)·24(100회)가 이 합을 본다 (titles.ts).
 * 메뉴별로 나눠 두는 것은 원본 저장 구조를 아직 못 찾아서다 — 합계만 쓰므로 안전하다 (추정).
 */
/** 몹쓸몸·유리몸 스킬 번호 — 그 스킬을 가진 채로 훈련한 횟수를 따로 센다 (A-4) */
const BAD_BODY_SKILL = 3
const FRAGILE_SKILL = 4

/**
 * 훈련 한 번을 센다 (0x18a80).
 * 통산 수와 함께 **칸별 연속 훈련 수**도 갱신한다 — 훈련한 칸은 +1, **나머지 칸은 모두 0** 이다.
 * 몹쓸몸·유리몸을 가진 채로 한 훈련도 따로 센다.
 */
export function countTraining(career: PlayerCareer, menuId: string): PlayerCareer {
  return {
    ...career,
    trainingCounts: { ...career.trainingCounts, [menuId]: trainingCountOf(career, menuId) + 1 },
    consecutiveTrainingCounts: { [menuId]: (career.consecutiveTrainingCounts[menuId] ?? 0) + 1 },
    badBodyTrainings: career.badBodyTrainings + (hasSkill(career, BAD_BODY_SKILL) ? 1 : 0),
    fragileTrainings: career.fragileTrainings + (hasSkill(career, FRAGILE_SKILL) ? 1 : 0),
  }
}

const MONEY_GRUBBER_SKILL = 2
const HELPLESS_SKILL = 5
/** 무력감 해제 카운터가 이어지는 기준 사기 (A-4) */
const HIGH_MORALE = 90

/**
 * 경기 뒤 카운터 (A-4) — 인기도 변화가 정해진 다음에 부른다.
 *   +0x1c2 이번 시즌 인기도 변화 합 · +0x1c0/+0x1cd 먹튀 보유 중 합/경기 수
 *   +0x1c7 무력감 보유 중 "경기 뒤 사기 ≥ 90" 연속 경기 수
 * 먹튀·무력감 카운터는 그 스킬이 **없으면 0** 으로 되돌린다.
 */
export function countGameForSkills(
  career: PlayerCareer,
  popularityChange: number,
): PlayerCareer {
  const hasMoneyGrubber = hasSkill(career, MONEY_GRUBBER_SKILL)
  const hasHelpless = hasSkill(career, HELPLESS_SKILL)
  return {
    ...career,
    seasonPopularityGain: career.seasonPopularityGain + popularityChange,
    moneyGrubberPopularityGain: hasMoneyGrubber ? career.moneyGrubberPopularityGain + popularityChange : 0,
    moneyGrubberGames: hasMoneyGrubber ? career.moneyGrubberGames + 1 : 0,
    highMoraleStreak: hasHelpless && career.morale >= HIGH_MORALE ? career.highMoraleStreak + 1 : 0,
  }
}

/** 이번 시즌 칸별 훈련 수 = 통산 − 새 시즌 사본 (A-4) */
export function seasonTrainingCountOf(career: PlayerCareer, menuId: string): number {
  return trainingCountOf(career, menuId) - (career.seasonStartTrainingCounts[menuId] ?? 0)
}

/** 이번 시즌 훈련 수 합계 */
export function seasonTrainingTotalOf(career: PlayerCareer): number {
  return Object.keys(career.trainingCounts).reduce(
    (total, menuId) => total + seasonTrainingCountOf(career, menuId),
    0,
  )
}

export function gainPopularity(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, popularity: clamp(career.popularity + amount, 0, MAXIMUM_POPULARITY) }
}

export function gainReputation(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, reputation: clamp(career.reputation + amount, 0, MAXIMUM_REPUTATION) }
}

/** G포인트를 더한다 (상한 99999). 원본은 전역 저장 +0x64 에 쌓는다 */
export function gainGamePoint(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, gamePoint: clamp(career.gamePoint + amount, 0, MAXIMUM_GAME_POINT) }
}

export function gainMorale(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, morale: clamp(career.morale + amount, 0, MAXIMUM_MORALE) }
}

/** 관리 주기의 행동 한 번을 쓴다. 경기를 치르면 다시 생긴다. */
export function spendCycleAction(career: PlayerCareer): PlayerCareer {
  return { ...career, hasActedThisCycle: true }
}

export function hasSkill(career: PlayerCareer, skillId: number): boolean {
  return career.skillIds.includes(skillId)
}

/** 마이너스 스킬 (표 0xd7e10) — 한 번 해제하면 다시 얻을 수 없다 */
export const MINUS_SKILL_IDS: readonly number[] = [2, 3, 4, 5, 17, 18, 19, 20]

/**
 * 보상 종류 4 — 양수 n 은 스킬 n−1 획득, 음수 −n 은 스킬 n−1 해제 (0x8c5bc).
 *
 * **마이너스 스킬을 해제하면 `+0x1d0+k` 플래그가 서서 다시 얻지 못한다** (0xa4430, A-6).
 * 획득 쪽도 그 플래그를 보고 막는다 — 웹에 통째로 빠져 있던 규칙이다.
 */
export function applySkillReward(career: PlayerCareer, value: number): PlayerCareer {
  const skillId = Math.abs(value) - 1
  if (value > 0) {
    if (hasSkill(career, skillId)) return career
    if (career.removedMinusSkillIds.includes(skillId)) return career
    return { ...career, skillIds: [...career.skillIds, skillId] }
  }
  if (!hasSkill(career, skillId)) return career
  const removed = MINUS_SKILL_IDS.includes(skillId) && !career.removedMinusSkillIds.includes(skillId)
  return {
    ...career,
    skillIds: career.skillIds.filter((id) => id !== skillId),
    removedMinusSkillIds: removed ? [...career.removedMinusSkillIds, skillId] : career.removedMinusSkillIds,
  }
}

export function affectionOf(career: PlayerCareer, heroineId: string): number {
  return career.affection[heroineId] ?? 0
}

export function gainAffection(
  career: PlayerCareer,
  heroineId: string,
  amount: number,
): PlayerCareer {
  const next = clamp(affectionOf(career, heroineId) + amount, 0, MAXIMUM_AFFECTION)
  return { ...career, affection: { ...career.affection, [heroineId]: next } }
}

export function gainAbility(
  career: PlayerCareer,
  gains: Partial<BatterAbility>,
): PlayerCareer {
  return {
    ...career,
    ability: {
      hit: clamp(career.ability.hit + (gains.hit ?? 0), 0, MAXIMUM_ABILITY),
      power: clamp(career.ability.power + (gains.power ?? 0), 0, MAXIMUM_ABILITY),
      run: clamp(career.ability.run + (gains.run ?? 0), 0, MAXIMUM_ABILITY),
      defense: clamp(career.ability.defense + (gains.defense ?? 0), 0, MAXIMUM_ABILITY),
    },
  }
}

/** 경기 결과를 커리어에 반영한다. G포인트 지급과 체력 회복이 함께 일어난다. */
export function applyGameResult(career: PlayerCareer, summary: GameSummary): PlayerCareer {
  const playedStats = recordGamePlayed(summary.stats)

  return {
    ...career,
    gamePoint: Math.min(MAXIMUM_GAME_POINT, career.gamePoint + gamePointRewardOf(summary)),
    gamesPlayed: career.gamesPlayed + 1,
    // 부상 중 치른 경기 수 (+0x1b6). 부상 기간은 경기로 줄지 않고 휴식·입원으로만 줄어든다 (G-2)
    injuredGamesPlayed: career.injuredGamesPlayed + (career.isInjured ? 1 : 0),
    illnessCooldown: Math.max(0, career.illnessCooldown - 1),
    // 원본은 **경기마다** 행동 플래그를 지운다 (0x4f158, G-6 확정). 관리 화면이 2경기마다만 열리므로
    // 결과는 같지만 기준이 다르다 — 여기서는 "이어하기로 두 번 행동" 을 막으려고 주기 기준을 쓴다.
    hasActedThisCycle:
      (career.gamesPlayed + 1) % GAMES_PER_MANAGEMENT_CYCLE === 0 ? false : career.hasActedThisCycle,
    bestHomeRunsInGame: Math.max(career.bestHomeRunsInGame, summary.stats.homeRuns),
    cycleHitGames: career.cycleHitGames + (isCycleHit(summary.stats) ? 1 : 0),
    eagleEyeGamesRemaining: Math.max(0, career.eagleEyeGamesRemaining - 1),
    stats: mergeStats(career.stats, playedStats),
    careerStats: mergeStats(career.careerStats, playedStats),
    // 사람 경기도 원본은 **같은 기록 함수 0xa8024** 를 부른다 — 동료 여덟 타순과 상대 팀 타석이
    // CPU 끼리 경기와 한 표에 쌓인다 (B-2). 내 선수만 빠져 있는데, 내 성적은 `stats` 가 이미
    // 세고 있어 두 번 세지 않으려는 것이다 (순위표를 만들 때 `myLeagueRecordOf` 로 끼워 넣는다).
    // 미션·홈런더비처럼 리그 밖 경기는 이 칸을 주지 않으므로 그때는 표가 그대로다.
    leaguePlayerStats: recordLeaguePlateAppearances(
      career.leaguePlayerStats,
      summary.leaguePlateAppearances ?? [],
    ),
    // 무승부는 원본도 승·패 어디에도 넣지 않는다.
    // **포스트시즌 중에는 정규시즌 전적을 건드리지 않는다** — 0xb76dc 가 포스트시즌 플래그로 갈라져
    // 시리즈 승수만 깎는다. 그래서 45경기 뒤에 치른 경기가 순위표에 더 쌓이지 않는다.
    league:
      summary.result === '무' || career.postseason !== null
        ? career.league
        : recordLeagueResult(
            career.league,
            summary.result === '승' ? summary.ourTeamId : summary.opponentTeamId,
            summary.result === '승' ? summary.opponentTeamId : summary.ourTeamId,
          ),
    // 포스트시즌 경기는 시리즈 승수로 들어간다 (0xb76dc 포스트시즌 분기)
    postseason:
      career.postseason === null || summary.result === '무'
        ? career.postseason
        : advancePostseason(
            career.postseason,
            summary.result === '승' ? summary.ourTeamId : summary.opponentTeamId,
          ),
    wins: career.wins + (summary.result === '승' ? 1 : 0),
    draws: career.draws + (summary.result === '무' ? 1 : 0),
    losses: career.losses + (summary.result === '패' ? 1 : 0),
  }
}

/**
 * 같은 날 나머지 네 경기를 치러 리그 전적에 넣는다.
 * 원본도 사람 경기 정산(0x4ea0c) 안에서 0xc2a48 을 따로 부른다 — 기록 갱신과 별개의 단계다.
 * `applyGameResult` 뒤에 부르는 것을 전제로 `gamesPlayed − 1` 을 일차로 쓴다.
 */
export function applyLeagueDay(career: PlayerCareer, myTeamId: number, random: RandomPort): PlayerCareer {
  const day = Math.max(0, career.gamesPlayed - 1)
  // 원본 0xc2a48 은 승패만이 아니라 **선수별 타석 기록(0xa8024)도** 남긴다 — 둘 다 받아 넣는다
  const played = playLeagueDay(career.league, day, myTeamId, random, career.leaguePlayerStats)
  return { ...career, league: played.league, leaguePlayerStats: played.playerStats }
}

/**
 * 45경기가 끝나면 정규시즌을 닫는다 (0xb818c).
 * 1위면 레코드 +0x7a 를 늘리고, 포스트시즌 대진(0xb80a8)을 연다.
 * 이미 포스트시즌이 열려 있으면 아무것도 하지 않는다.
 */
export function applySeasonEnd(career: PlayerCareer): PlayerCareer {
  if (career.postseason !== null || career.gamesPlayed < GAMES_PER_SEASON) return career
  const result = finishRegularSeason(career.league, career.teamId)
  return {
    ...career,
    regularSeasonFirstCount: career.regularSeasonFirstCount + (result.isRegularSeasonFirst ? 1 : 0),
    postseason: result.postseason,
  }
}

/**
 * 포스트시즌을 내 차례까지 진행한다 (0x13da0).
 * 내 팀이 지금 시리즈에 있으면 그대로 두고, 아니면 CPU 끼리 돌려 다음 차례를 만든다.
 */
export function applyPostseasonProgress(career: PlayerCareer, random: RandomPort): PlayerCareer {
  if (career.postseason === null) return career
  const advanced = runCpuPostseason(career.postseason, career.teamId, random)
  return advanced === career.postseason ? career : { ...career, postseason: advanced }
}

/**
 * 다음 경기 상대 (0xb765c).
 * 정규시즌은 일정표 0xd89cb 에서 그날 상대를 읽고, 포스트시즌은 지금 시리즈의 맞은편이다.
 * 포스트시즌인데 내 팀이 그 시리즈에 없으면(진출 실패) 상대가 없다 — 그때는 일정표로 돌아간다 (추정).
 */
export function nextOpponentOf(career: PlayerCareer): number {
  const series = career.postseason
  if (series !== null && series.round !== '종료') {
    if (series.teams[0] === career.teamId) return series.teams[1]
    if (series.teams[1] === career.teamId) return series.teams[0]
  }
  return opponentOf(career.gamesPlayed, career.teamId)
}

/** 원본 전역 G포인트 상한 */
const MAXIMUM_GAME_POINT = BALANCE.limits.gamePoint

/** 경기 끝 G포인트 = 달성 기록 금액 합 (0x4ea0c, 누락 탐색 9차). 출전·승리 보너스는 원본에 없다 */
export function gamePointRewardOf(summary: GameSummary): number {
  return recordGamePointsOf(summary.recordIds)
}

export function isManagementCycleOpen(career: PlayerCareer): boolean {
  return career.gamesPlayed > 0 && career.gamesPlayed % GAMES_PER_MANAGEMENT_CYCLE === 0
}

export function isSeasonFinished(career: PlayerCareer): boolean {
  return career.gamesPlayed >= GAMES_PER_SEASON
}

/**
 * 시즌을 넘긴다 (0x1b768 · 안쪽 `0xa39a8`, S13 2절 전수 확정).
 * 시즌 성적은 초기화되고 통산 성적은 남는다.
 *
 * ⚠️ **원본 버그 그대로** — `0xa39bc`·`0xa39c6` 이 **둘 다 `S+0x1e0`** 을 16바이트 지운다.
 * 경기 뒤 누적 카운터는 `+0x1e0`·`+0x1f0` **두 벌**이고 `0xa690c` 가 같은 값을 양쪽에 더하는데,
 * 둘째 줄이 `r6`(= `S + 0x1e0`)을 그대로 다시 써서 **`+0x1f0` 벌은 영영 안 지워진다**
 * → 나리 누적 카운터 한 벌이 해를 넘겨 계속 쌓인다.
 * 웹판에는 그 두 벌짜리 누적 카운터 자체가 없어 **옮길 코드가 없다** — 사실만 적어 둔다.
 */
export function startNextSeason(career: PlayerCareer): PlayerCareer {
  return {
    ...career,
    season: career.season + 1,
    gamesPlayed: 0,
    outingsThisSeason: 0,
    // 인기도 스냅샷 (+0x78 ← 지금 인기도, 0xa39e0) — 올해의 목표 "인기도 상승" 의 기준점
    popularityAtSeasonStart: career.popularity,
    // 올해의 목표 플래그 두 개를 되돌린다 — +0x1b7(0xa39d0) 창을 봤다 · +0x1bc(0x1b882) 연초 이벤트
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    // 새 시즌 시작 때 통산 훈련 수를 떠 둔다 (+0x6b+i) — 이번 시즌 훈련 수를 빼서 구한다
    seasonStartTrainingCounts: { ...career.trainingCounts },
    // 이번 시즌 인기도 변화 합은 새 시즌에 0 이다 (+0x1c2)
    seasonPopularityGain: 0,
    // 새 시즌 전환 0x1b768: 사기 100, 소지금 += 연봉
    morale: MAXIMUM_MORALE,
    money: Math.min(MAXIMUM_MONEY, career.money + career.salary * ORIGINAL_MONEY_UNIT),
    stats: EMPTY_SEASON_STATS,
    // 리그를 새로 깐다 — `0xa39ae` 가 리그 객체(S+0x80)를 초기화하고, 뒤이어 `0x204e0(저장, 편, 0)`
    // 이 **리그 전 선수의 시즌 성적**을 0 으로 되돌린다(팀 레코드·능력치·사기는 그대로 둔다).
    // 웹판은 로스터가 붙박이 표라 성적만 따로 `leaguePlayerStats` 에 담는다 — 그 표가 0x204e0 이
    // 지우는 칸에 해당하므로 여기서 함께 비운다.
    league: EMPTY_LEAGUE,
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    postseason: null,
    wins: 0,
    draws: 0,
    losses: 0,
  }
}

/** 한 경기에 단타·2루타·3루타·홈런을 모두 쳤는가 */
function isCycleHit(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
