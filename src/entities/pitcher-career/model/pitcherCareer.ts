import { BALANCE } from '@/shared/config/original/balance'
import { EMPTY_LEAGUE, advancePostseason, opponentOf, recordLeagueResult } from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import { finishRegularSeason } from '@/entities/league/model/seasonEnd'
import { runCpuPostseason } from '@/entities/league/model/postseasonPlay'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { NO_EQUIPPED_TITLE } from '@/entities/career/model/titles'
import {
  MAXIMUM_PITCHER_ABILITY,
  PITCHER_ABILITY_ORDER,
  pitcherAbilityLimitOf,
} from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA, recoverStaminaAfterGameDay } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  DEFAULT_PITCHER_ROOKIE_PROFILE,
  pitcherFormOf,
  rookiePitcherAbilityOf,
  rookiePitchMaskOf,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'

/**
 * 나만의리그 **투수편**(원본 모드 3) 육성 선수 레코드.
 *
 * 타자편 `entities/career/model/playerCareer.ts` 의 `PlayerCareer` 와 **같은 칸을 쓰되**
 * 능력치 구성이 다르다. 무엇이 같고 무엇이 다른지는 해독 문서로 갈랐다.
 *
 * **같은 칸** (한 벌의 육성 코드가 모드 3·4 를 함께 돌린다 — 관리 장면 0x106 은 모드 3·4 공용이다,
 *  R9 2절·H-modes 170행):
 *   - 인기도 `+0x4a` · 평판 `+0x62`(경기 뒤 평가 0xa6218·0xa690c 가 모드로만 갈린다, P1 5-2·5-3)
 *   - 사기(0xa73c4 는 **한 줄만** 투수편 선발용으로 갈린다, P1 5-4) · 소지금 · 연봉 · G포인트
 *   - 스킬 보유 비트 `+0x1b8` · 마이너스 스킬 해제 플래그 `+0x1d0+k` · 칭호 · 서브 아이템 `+0x58+k`
 *   - 장비 니블(부위 4칸) · 히든 오픈 (컬렉터 해금 id 만 투수 20·24·28·32 로 다르다, R12 5절)
 *   - 부상·질병·관리 주기 행동 플래그 · 외출 횟수 · 이벤트 진행 · 올해의 목표 칸
 *   - 리그 전적·리그 선수 성적·포스트시즌 (같은 0xb76dc·0xc2a48 을 쓴다)
 *
 * **다른 칸**:
 *   - 능력치가 **제구·구속·변화·체력** 네 칸이다 (`+0xc` 부터 s16, P1 4-1 · R7 3절).
 *     한계도 배팅 타입이 아니라 **보직**으로 고른다 (`pitcherAbilityLimitOf`).
 *   - **스태미나 `+0x2c`(0~10000)** 가 시즌 내내 이어진다 — 타자편에 없는 칸이다 (P1 3절).
 *   - **보직 `+0xb & 3`** 과 **포지션 코드 `+0xa & 0x1f`** 가 등판·강판·평가를 가른다 (`pitcherRole.ts`).
 *   - 시즌 성적이 타율·홈런이 아니라 **아웃 +0x20 · 실점 +0x22 · 세이브 +0x24 · 탈삼진 +0x26 ·
 *     투구 수 +0x28 · 승 +0x2e · 패 +0x2f** 다 (P1 6절 · FOR-IMPLEMENTER B-2).
 *   - 필살타법 자리에 **마구 레벨**(필살 창 탭 0·1, 투수 표 0xcc368)과
 *     **구질 훈련 단계**(커리어 `+0x208`, 훈련 창은 모드 3 에서 상태 0x78, J 3-2 · R7 4절)가 들어간다.
 *   - 타순·배팅 타입·사이클 히트·연속 안타 기록처럼 **타자만 쓰는 칸은 없다**.
 */

/** 능력치 상한 (0xb6414 가 999 로 자른다) */
export const MAXIMUM_ABILITY = MAXIMUM_PITCHER_ABILITY
const MAXIMUM_MORALE = BALANCE.limits.morale
const MAXIMUM_POPULARITY = BALANCE.limits.popularity
const MAXIMUM_REPUTATION = BALANCE.limits.reputation
const MAXIMUM_GAME_POINT = BALANCE.limits.gamePoint
const MAXIMUM_AFFECTION = BALANCE.limits.affection
/** 원본 소지금·연봉 한 칸 = 100만원 */
export const ORIGINAL_MONEY_UNIT = BALANCE.money.unit
const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT

/** 관리 메뉴 주기 · 한 시즌 경기 수 — 타자편과 같다 (StrHOWTO[10][11]) */
export const GAMES_PER_MANAGEMENT_CYCLE = BALANCE.season.gamesPerManagementCycle
export const GAMES_PER_SEASON = BALANCE.season.gamesPerSeason

/** 신인 시작값 — 나만의리그 공통 초기화 0x11244~0x11296 (타자편과 같은 코드다) */
export const STARTING_POPULARITY = BALANCE.rookie.popularity
export const STARTING_REPUTATION = BALANCE.rookie.reputation
export const STARTING_MORALE = BALANCE.rookie.morale
export const STARTING_SALARY = BALANCE.rookie.salary
export const STARTING_MONEY = BALANCE.rookie.money
const STARTING_GAME_POINT = BALANCE.rookie.gamePoint
/** 신인 스킬 — 0 병아리 · 8 의외성 (0x11230). 투수편도 같은 초기화를 지난다 */
const STARTING_SKILL_IDS: readonly number[] = BALANCE.rookie.skillIds

/** 기본 소속 팀 — 서울 드래곤즈 */
export const DEFAULT_TEAM_ID = 0

/** 구질 훈련 칸 수 — 4계열 × 2줄 (커리어 +0x208 + (행·2 + 열%2)·4 + 1, J 3-2) */
export const PITCH_TRAINING_CELL_COUNT = 8
/** 히든 변화구 계열 수 (커리어 +0x204+행) */
export const HIDDEN_PITCH_ROW_COUNT = 4

/** 투수 시즌 성적 — 레코드 칸 그대로다 */
export interface PitcherSeasonStats {
  /** 등판 경기 수 (표시용. 원본 칸은 못 찾았다 — 웹에서만 센다) */
  readonly games: number
  /** +0x20 아웃 */
  readonly outs: number
  /** +0x22 실점 */
  readonly runsAllowed: number
  /** +0x24 세이브 */
  readonly saves: number
  /** +0x26 탈삼진 */
  readonly strikeouts: number
  /** +0x28 투구 수 */
  readonly pitches: number
  /** +0x2e 승 */
  readonly wins: number
  /** +0x2f 패 */
  readonly losses: number
}

export const EMPTY_PITCHER_SEASON_STATS: PitcherSeasonStats = {
  games: 0,
  outs: 0,
  runsAllowed: 0,
  saves: 0,
  strikeouts: 0,
  pitches: 0,
  wins: 0,
  losses: 0,
}

export interface PitcherCareer {
  readonly name: string
  /** 제구·구속·변화·체력 (레코드 +0xc 부터 s16 네 칸) */
  readonly ability: PitcherAbility
  /** 보직 `+0xb & 3` — 등판·강판·사기·능력 한계가 본다 */
  readonly role: PitcherRole
  /** 포지션 코드 `+0xa & 0x1f` — 경기 뒤 평가가 "≤3 선발형" 으로만 쓴다 */
  readonly positionCode: number
  /** 등록 타입 0~2 (`+0xb` bit5~7). 폼 = 2×타입 + 손 */
  readonly typeIndex: number
  /** 0 우완 · 1 좌완 (`+0xb` bit4) */
  readonly handIndex: number
  /** 0 황인 · 1 백인 · 2 흑인 (`+0xb` bit2~3) */
  readonly skinIndex: number
  /** 보유 구질 비트마스크 `+0x1c` (비트 t−1 = 구질 t) */
  readonly pitchMask: number
  /**
   * 마구 **배운 수** 0~4 — 필살타법 창(탭 0·1)의 훈련 단계, 저장 `+0x201` 자리다
   * (타자 필살타법과 같은 칸, H-4 · H2 1-2). 0 이면 마구가 없다.
   *
   * ⚠️ 배운 수는 **고를 수 있는 번호의 상한**일 뿐이고, 경기에 실리는 것은 아래
   * `selectedMagicNumber`(레코드 +0x18) 다 (H2 1-2 "레벨은 여기서 직접 쓰이지 않는다").
   */
  readonly magicLevel: number
  /**
   * 고른 마구 번호 — 레코드 `+0x18` (0 없음 · 1~4). 123 창(키 0x17cec)이 표 0xcc368 = [1,2,3,4]
   * 에서 골라 넣는다. 번호 4 는 폼에 따라 샤이닝·캐넌·미라지로 이름만 갈린다 (H2 2절).
   */
  readonly selectedMagicNumber: number
  /**
   * 고른 구질 — 123 창 탭 2 (StrMODE[72] "현재 사용 중인 구질입니다" · [73] "해당 구질을
   * 사용하시겠습니까?"). 0 이면 고른 적이 없다.
   *
   * ⚠️ **원본 저장 칸을 못 찾았다**: 경기의 구질 칸 6개는 0xb6d2c 가 **마스크 +0x1c 만** 보고 만들고
   * (H2 3-1), 0x17cec 의 탭 2 가지가 무엇을 쓰는지는 해독 문서에 없다. 그래서 이 칸은 아직
   * **경기로 넘어가지 않는다** — 원본 칸이 밝혀지면 여기를 그 칸으로 바꾸면 된다.
   */
  readonly selectedPitchType: number
  /** 이번 레벨에 쌓은 마구 훈련 횟수 (타자 필살타법 +0x200 자리) */
  readonly magicSessions: number
  /** 구질 훈련 단계 8칸 — 0 없음 · 1 기본 습득 · 2 상위 습득 (커리어 +0x208, J 3-2) */
  readonly pitchTrainingStages: readonly number[]
  /** 히든 변화구 계열이 열렸는가 (커리어 +0x204+행, 이벤트 30~33) */
  readonly hiddenPitchRows: readonly boolean[]
  /** 스태미나 +0x2c (0~10000). 시즌 시작 0xb6cc4 가 10000 으로 둔다 */
  readonly stamina: number

  readonly gamePoint: number
  readonly season: number
  readonly gamesPlayed: number
  readonly stats: PitcherSeasonStats
  readonly careerStats: PitcherSeasonStats
  readonly teamId: number
  readonly popularity: number
  readonly reputation: number
  readonly morale: number
  readonly money: number
  readonly salary: number
  readonly skillIds: readonly number[]
  readonly removedMinusSkillIds: readonly number[]
  readonly titleIds: readonly string[]
  /**
   * 지금 장착한 칭호 번호 — 원본 선수 레코드 **+0x1c4** (타자편 `PlayerCareer.equippedTitle` 과 같은 칸).
   * 새 선수는 **−1**(없음)이고, 칭호를 얻으면 그 자리에서 곧바로 여기에 번호가 들어간다 (0x1b214).
   * 투수편 번호는 48~63 이라 이름표 `TITLE_NAMES[번호]` 가 그대로 투수 이름이다 (P3 8절).
   */
  readonly equippedTitle: number
  readonly subItemIds: readonly number[]
  /** 장착 레벨 니블 (0 = 미장착, 1~11 = 레벨+1) — 능력치 이름으로 부위를 가리킨다 */
  readonly equipmentLevels: PitcherAbility
  readonly ownedEquipment: readonly string[]
  readonly openedHiddenIds: readonly number[]
  readonly affection: Readonly<Record<string, number>>
  readonly seenEventIds: readonly string[]
  readonly storySceneIndex: number
  readonly trainingCounts: Readonly<Record<string, number>>
  readonly seasonStartTrainingCounts: Readonly<Record<string, number>>
  readonly consecutiveTrainingCounts: Readonly<Record<string, number>>
  readonly hasActedThisCycle: boolean
  readonly outingsThisSeason: number
  /** 지난 시즌 외출 수 — 칭호 25·26 이 새 시즌 첫 경기 전에 본다 (타자편 `outingsLastSeason` 과 같은 칸) */
  readonly outingsLastSeason: number
  readonly isInjured: boolean
  readonly injuredGamesPlayed: number
  readonly injuryRemaining: number
  readonly isSick: boolean
  readonly illnessName: string | null
  readonly illnessRemaining: number
  readonly illnessCooldown: number
  readonly mvpSeasonBits: number
  readonly seasonPopularityGain: number
  readonly popularityAtSeasonStart: number
  readonly hasSeenYearGoalWindow: boolean
  readonly yearGoalEventDone: boolean
  readonly endingIndex: number | null
  readonly league: League
  readonly leaguePlayerStats: LeaguePlayerStats
  readonly regularSeasonFirstCount: number
  readonly postseason: PostseasonSeries | null
  readonly lastMidSeasonGoalCount: number
  /** 팀 전적 (내 팀이 치른 경기) */
  readonly wins: number
  readonly draws: number
  readonly losses: number
}

export function createPitcherCareer(
  name: string,
  profile: PitcherRookieProfile = DEFAULT_PITCHER_ROOKIE_PROFILE,
): PitcherCareer {
  return {
    name,
    ability: rookiePitcherAbilityOf(profile.role, profile.typeIndex),
    role: profile.role,
    // 등록 셋업이 rec[+0xa] 에 0x80 을 쓴다 (bit7 = 내 육성 선수) — 아래 5비트는 0 이라
    // 포지션 코드도 0 이다 → 경기 뒤 평가는 **선발형**(≤3)으로 본다 (C-4 · 0xb6394).
    positionCode: 0,
    typeIndex: profile.typeIndex,
    handIndex: profile.handIndex,
    skinIndex: profile.skinIndex,
    pitchMask: rookiePitchMaskOf(profile.breakingPitchSlots),
    magicLevel: 0,
    // 신인은 마구도 고른 구질도 없다 (레코드 +0x18 = 0)
    selectedMagicNumber: 0,
    selectedPitchType: 0,
    magicSessions: 0,
    pitchTrainingStages: rookiePitchTrainingStagesOf(profile.breakingPitchSlots),
    hiddenPitchRows: new Array<boolean>(HIDDEN_PITCH_ROW_COUNT).fill(false),
    stamina: FULL_STAMINA,
    gamePoint: STARTING_GAME_POINT,
    season: 1,
    gamesPlayed: 0,
    stats: EMPTY_PITCHER_SEASON_STATS,
    careerStats: EMPTY_PITCHER_SEASON_STATS,
    teamId: profile.teamId ?? DEFAULT_TEAM_ID,
    popularity: STARTING_POPULARITY,
    reputation: STARTING_REPUTATION,
    morale: STARTING_MORALE,
    money: STARTING_MONEY,
    salary: STARTING_SALARY,
    skillIds: STARTING_SKILL_IDS,
    removedMinusSkillIds: [],
    titleIds: [],
    // 선수 +0x1c4 는 만들 때 −1 이다 — 기본정보 카드가 그 값이면 칭호 줄을 안 그린다 (0x11292)
    equippedTitle: NO_EQUIPPED_TITLE,
    subItemIds: [],
    equipmentLevels: { control: 0, velocity: 0, breaking: 0, stamina: 0 },
    ownedEquipment: [],
    openedHiddenIds: [],
    affection: {},
    seenEventIds: [],
    storySceneIndex: 0,
    trainingCounts: {},
    seasonStartTrainingCounts: {},
    consecutiveTrainingCounts: {},
    hasActedThisCycle: false,
    outingsThisSeason: 0,
    outingsLastSeason: 0,
    isInjured: false,
    injuredGamesPlayed: 0,
    injuryRemaining: 0,
    isSick: false,
    illnessName: null,
    illnessRemaining: 0,
    illnessCooldown: 0,
    mvpSeasonBits: 0,
    seasonPopularityGain: 0,
    popularityAtSeasonStart: STARTING_POPULARITY,
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    endingIndex: null,
    league: EMPTY_LEAGUE,
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    regularSeasonFirstCount: 0,
    postseason: null,
    lastMidSeasonGoalCount: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  }
}

/**
 * 등록에서 고른 기본 변화구 두 개는 **단계 1** 로 적힌다
 * (`커리어+0x208+k·4+1 = 1`, J 3-1). 칸 번호는 구질 훈련 표의 (행·2 + 열%2) 와 같다.
 */
function rookiePitchTrainingStagesOf(slots: readonly number[]): number[] {
  const stages = new Array<number>(PITCH_TRAINING_CELL_COUNT).fill(0)
  for (const slot of slots) {
    if (slot >= 0 && slot < PITCH_TRAINING_CELL_COUNT) stages[slot] = 1
  }
  return stages
}

/* ── 값 올리기 ─────────────────────────────────────────────────────────────── */

export function gainPitcherPopularity(career: PitcherCareer, amount: number): PitcherCareer {
  return { ...career, popularity: clamp(career.popularity + amount, 0, MAXIMUM_POPULARITY) }
}

export function gainPitcherReputation(career: PitcherCareer, amount: number): PitcherCareer {
  return { ...career, reputation: clamp(career.reputation + amount, 0, MAXIMUM_REPUTATION) }
}

export function gainPitcherMorale(career: PitcherCareer, amount: number): PitcherCareer {
  return { ...career, morale: clamp(career.morale + amount, 0, MAXIMUM_MORALE) }
}

export function gainPitcherGamePoint(career: PitcherCareer, amount: number): PitcherCareer {
  return { ...career, gamePoint: clamp(career.gamePoint + amount, 0, MAXIMUM_GAME_POINT) }
}

export function gainPitcherAffection(career: PitcherCareer, heroineId: string, amount: number): PitcherCareer {
  const next = clamp((career.affection[heroineId] ?? 0) + amount, 0, MAXIMUM_AFFECTION)
  return { ...career, affection: { ...career.affection, [heroineId]: next } }
}

export function gainPitcherAbility(career: PitcherCareer, gains: Partial<PitcherAbility>): PitcherCareer {
  const ability = { ...career.ability }
  for (const key of PITCHER_ABILITY_ORDER) {
    ability[key] = clamp(ability[key] + (gains[key] ?? 0), 0, MAXIMUM_ABILITY)
  }
  return { ...career, ability }
}

export function hasPitcherSkill(career: PitcherCareer, skillId: number): boolean {
  return career.skillIds.includes(skillId)
}

export function spendPitcherCycleAction(career: PitcherCareer): PitcherCareer {
  return { ...career, hasActedThisCycle: true }
}

/** 능력 한계 — 타자와 달리 **보직**으로 행을 고른다 (0xa44f4, R7 3절) */
export function pitcherAbilityLimitsOf(career: PitcherCareer): PitcherAbility {
  return pitcherAbilityLimitOf(career.role)
}

/**
 * `0xb6414(기록, i, 1)` 까지 본 능력치 — 장착 레벨 보너스만 넣는다.
 *
 * 투수 스킬 보정(무기력·전설 같은 타자 쪽 스킬 번호)은 **투수 번호가 문서에 없어** 넣지 않는다.
 * 넣어야 할 값은 StrSKILL 의 투수 항목에서 와야 한다 (P1 3-1 이 가리키는 스킬 10·18·26 만 확정).
 */
export function equippedPitcherAbilityOf(career: PitcherCareer): PitcherAbility {
  const adjust = (key: keyof PitcherAbility) =>
    clamp(career.ability[key] + equipmentBonusOf(career.equipmentLevels[key]), 0, MAXIMUM_ABILITY)
  return {
    control: adjust('control'),
    velocity: adjust('velocity'),
    breaking: adjust('breaking'),
    stamina: adjust('stamina'),
  }
}

/**
 * 경기용 실효 능력치 `0xb570c` — 장비 보정 뒤에 **질병 → 부상 → 사기 감소** 차례다 (G-1).
 * 타자편 `condition.ts` 와 같은 코드를 쓰므로 비율도 같다.
 */
const ILLNESS_ABILITY_CUT = 30
const INJURY_ABILITY_CUT = 50
const MORALE_ABILITY_CUTS: readonly (readonly [number, number])[] = [
  [10, 50],
  [30, 20],
  [50, 10],
]

export function effectivePitcherAbilityOf(career: PitcherCareer): PitcherAbility {
  const moraleCut = MORALE_ABILITY_CUTS.find(([limit]) => career.morale <= limit)?.[1] ?? 0
  const equipped = equippedPitcherAbilityOf(career)
  const adjust = (key: keyof PitcherAbility) => {
    let value = equipped[key]
    if (career.isSick) value = reduceByPercent(value, ILLNESS_ABILITY_CUT)
    if (career.isInjured) value = reduceByPercent(value, INJURY_ABILITY_CUT)
    if (moraleCut > 0) value = reduceByPercent(value, moraleCut)
    return clamp(value, 0, MAXIMUM_ABILITY)
  }
  return {
    control: adjust('control'),
    velocity: adjust('velocity'),
    breaking: adjust('breaking'),
    stamina: adjust('stamina'),
  }
}

/** 투수 폼 `0xb6e24` = 레코드 +0xb 윗니블 = **2×타입 + 손** (0x16f9a, C 표) */
export function pitcherFormOfCareer(career: PitcherCareer): number {
  return pitcherFormOf(career.typeIndex, career.handIndex)
}

/* ── 경기 뒤 ───────────────────────────────────────────────────────────────── */

/**
 * 경기 한 판의 결과 — `features/play-pitcher-game` 의 `PitcherGameSummary` 에서 뽑아 넘긴다.
 * (entities 는 features 를 모르는 층이라 필요한 칸만 받는 꼴로 둔다.)
 */
export interface PitcherGameOutcome {
  readonly result: '승' | '패' | '무'
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** `summaryOf(progress).seasonDelta` 그대로 */
  readonly seasonDelta: {
    readonly outs: number
    readonly runsAllowed: number
    readonly strikeouts: number
    readonly pitches: number
    readonly wins: number
    readonly losses: number
    readonly saves: number
  }
  /** 경기 뒤 스태미나 (레코드 +0x2c) */
  readonly stamina: number
  /** 이 경기에 실제로 등판했는가 — 등판 경기 수만 센다 */
  readonly entered: boolean
  /** 경기 끝 G포인트 (기록 달성 합) */
  readonly gamePointReward: number
}

function mergeStats(base: PitcherSeasonStats, delta: PitcherGameOutcome['seasonDelta'], entered: boolean): PitcherSeasonStats {
  return {
    games: base.games + (entered ? 1 : 0),
    outs: base.outs + delta.outs,
    runsAllowed: base.runsAllowed + delta.runsAllowed,
    saves: base.saves + delta.saves,
    strikeouts: base.strikeouts + delta.strikeouts,
    pitches: base.pitches + delta.pitches,
    wins: base.wins + delta.wins,
    losses: base.losses + delta.losses,
  }
}

/**
 * 경기 결과를 커리어에 반영한다 (타자편 `applyGameResult` 자리).
 *
 * 스태미나는 경기가 남긴 값을 그대로 받고, **하루가 끝날 때** `0xb60e0` 회복이 더해진다
 * (모드 3 · 내 선수 · 선발 40% · 구원 80%, P1 3절).
 *
 * ⚠️ **원본 그대로**: 관리 주기의 행동 플래그는 **경기마다** 풀린다 (0x4f158, G-6 확정).
 * 타자편 웹 코드는 "2경기마다" 로 두었지만 원본 기준은 경기 한 번이다 — 여기서는 원본을 따른다.
 */
export function applyPitcherGameResult(career: PitcherCareer, outcome: PitcherGameOutcome): PitcherCareer {
  const recovered = recoverStaminaAfterGameDay(outcome.stamina, {
    mode: PITCHER_EDITION_MODE,
    isMine: true,
    isStarterRole: career.role === PITCHER_ROLE.starter,
  })
  return {
    ...career,
    gamesPlayed: career.gamesPlayed + 1,
    gamePoint: clamp(career.gamePoint + outcome.gamePointReward, 0, MAXIMUM_GAME_POINT),
    stamina: recovered,
    stats: mergeStats(career.stats, outcome.seasonDelta, outcome.entered),
    careerStats: mergeStats(career.careerStats, outcome.seasonDelta, outcome.entered),
    injuredGamesPlayed: career.injuredGamesPlayed + (career.isInjured ? 1 : 0),
    illnessCooldown: Math.max(0, career.illnessCooldown - 1),
    hasActedThisCycle: false,
    league:
      outcome.result === '무' || career.postseason !== null
        ? career.league
        : recordLeagueResult(
            career.league,
            outcome.result === '승' ? outcome.ourTeamId : outcome.opponentTeamId,
            outcome.result === '승' ? outcome.opponentTeamId : outcome.ourTeamId,
          ),
    postseason:
      career.postseason === null || outcome.result === '무'
        ? career.postseason
        : advancePostseason(
            career.postseason,
            outcome.result === '승' ? outcome.ourTeamId : outcome.opponentTeamId,
          ),
    wins: career.wins + (outcome.result === '승' ? 1 : 0),
    draws: career.draws + (outcome.result === '무' ? 1 : 0),
    losses: career.losses + (outcome.result === '패' ? 1 : 0),
  }
}

/** 같은 날 나머지 네 경기 (0xc2a48) — 타자편과 같은 코드를 부른다 */
export function applyPitcherLeagueDay(career: PitcherCareer, random: RandomPort): PitcherCareer {
  const day = Math.max(0, career.gamesPlayed - 1)
  const played = playLeagueDay(career.league, day, career.teamId, random, career.leaguePlayerStats)
  return { ...career, league: played.league, leaguePlayerStats: played.playerStats }
}

/** 45경기가 끝나면 정규시즌을 닫는다 (0xb818c) */
export function applyPitcherSeasonEnd(career: PitcherCareer): PitcherCareer {
  if (career.postseason !== null || career.gamesPlayed < GAMES_PER_SEASON) return career
  const result = finishRegularSeason(career.league, career.teamId)
  return {
    ...career,
    regularSeasonFirstCount: career.regularSeasonFirstCount + (result.isRegularSeasonFirst ? 1 : 0),
    postseason: result.postseason,
  }
}

/** 포스트시즌을 내 차례까지 진행한다 (0x13da0) */
export function applyPitcherPostseasonProgress(career: PitcherCareer, random: RandomPort): PitcherCareer {
  if (career.postseason === null) return career
  const advanced = runCpuPostseason(career.postseason, career.teamId, random)
  return advanced === career.postseason ? career : { ...career, postseason: advanced }
}

/** 다음 경기 상대 (0xb765c) — 타자편 `nextOpponentOf` 와 같은 규칙이다 */
export function nextPitcherOpponentOf(career: PitcherCareer): number {
  const series = career.postseason
  if (series !== null && series.round !== '종료') {
    if (series.teams[0] === career.teamId) return series.teams[1]
    if (series.teams[1] === career.teamId) return series.teams[0]
  }
  return opponentOf(career.gamesPlayed, career.teamId)
}

export function isPitcherManagementCycleOpen(career: PitcherCareer): boolean {
  return career.gamesPlayed > 0 && career.gamesPlayed % GAMES_PER_MANAGEMENT_CYCLE === 0
}

export function isPitcherSeasonFinished(career: PitcherCareer): boolean {
  return career.gamesPlayed >= GAMES_PER_SEASON
}

/**
 * 시즌을 넘긴다 (0x1b768). 타자편 `startNextSeason` 과 같은 자리에
 * **스태미나 되돌리기**(시즌 시작 0xb6cc4 → 10000)가 하나 더 붙는다.
 */
export function startNextPitcherSeason(career: PitcherCareer): PitcherCareer {
  return {
    ...career,
    season: career.season + 1,
    gamesPlayed: 0,
    // 칭호 25·26 은 새 시즌 첫 경기 전에 **지난해** 외출 수로 본다 (P3 9절)
    outingsThisSeason: 0,
    outingsLastSeason: career.outingsThisSeason,
    popularityAtSeasonStart: career.popularity,
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    seasonStartTrainingCounts: { ...career.trainingCounts },
    seasonPopularityGain: 0,
    morale: MAXIMUM_MORALE,
    money: Math.min(MAXIMUM_MONEY, career.money + career.salary * ORIGINAL_MONEY_UNIT),
    stamina: FULL_STAMINA,
    stats: EMPTY_PITCHER_SEASON_STATS,
    league: EMPTY_LEAGUE,
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    postseason: null,
    wins: 0,
    draws: 0,
    losses: 0,
  }
}

/** 방어율 × 100 (0xb6ce8) — 경기 화면 밖(성적 화면)에서도 같은 식을 쓴다 */
export function seasonEarnedRunAverageOf(stats: PitcherSeasonStats): number {
  if (stats.outs > 0) return Math.min(9999, Math.trunc((stats.runsAllowed * 2700) / stats.outs))
  return stats.runsAllowed > 0 ? 9999 : 0
}

function reduceByPercent(value: number, percent: number): number {
  return value - Math.trunc((value * percent) / 100)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
