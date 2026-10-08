import { BALANCE } from '@/shared/config/original/balance'
import {
  EMPTY_LEAGUE,
  advancePostseason,
  nextSeasonLeague,
  opponentOf,
  pitcherOrdersAfterPostseason,
  recordLeagueResult,
  rotateLeaguePitchers,
  startPostseason,
} from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import { finishRegularSeason } from '@/entities/league/model/seasonEnd'
import { runCpuPostseasonWithStamina } from '@/entities/league/model/postseasonPlay'
import type { PitcherStaminaTable } from '@/entities/league/model/postseasonPlay'
import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import {
  humanGamePitcherOrderOf,
  humanGamePitcherStaminasOf,
  recordHumanGamePitchers,
  recoveredLeagueStaminas,
  staminaTableAfterHumanGame,
} from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { NO_EQUIPPED_TITLE } from '@/entities/career/model/titles'
import {
  countReputationZeroGame,
  addSeasonPopularityGain,
  countSkillGameCounters,
  endNationalCup,
  isSkillEquipped,
  setSkillEquipped,
} from '@/entities/career/model/playerCareer'
import type { SeasonEndState } from '@/entities/career/model/playerCareer'
import type { NariTeamRecords } from '@/entities/career/model/nariTeamRecord'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import {
  MAXIMUM_PITCHER_ABILITY,
  PITCHER_ABILITY_ORDER,
  pitcherAbilityLimitOf,
} from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { EMPTY_PITCHER_STREAKS } from '@/entities/pitcher-career/model/pitcherStreaks'
import type { PitcherStreaks } from '@/entities/pitcher-career/model/pitcherStreaks'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA, recoverStaminaAfterGameDay } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_EDITION_MODE, cpuGameRotationAdvances } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  gameMyPitcherOrderOf,
  legacyMyPitcherOrderOf,
  moveMyPitcherToStart,
  myPitcherPositionCodeOf,
  prepareMyPitcherOrder,
  recordedMyPitcherOrderOf,
  withMyPitcherOrder,
} from '@/entities/pitcher-career/model/myPitcherRecord'
import type { MyPitcherDay } from '@/entities/pitcher-career/model/myPitcherRecord'
import { myPitcherRegistrationSlotOf, registeredMyPitcherOrderOf } from '@/entities/pitcher-career/model/myPitcherRecord'
import { createNariTeamRecords } from '@/entities/career/model/nariTeamRecord'
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
 *   - 스킬 **장착** 비트 = 선수기록 `+0x14` · 슬롯 단계 `P+0x1c6` (장착 동작 0xa4b04 가 모드 3·4 공용)
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

/** 선수 +0x1f0 u16[0..3] — 완투 계열 횟수 (통산, 새 시즌에도 지우지 않는다) */
export interface CompleteGameCounts {
  readonly perfect: number
  readonly noHitter: number
  readonly shutout: number
  readonly completeGame: number
}

export const EMPTY_COMPLETE_GAME_COUNTS: CompleteGameCounts = { perfect: 0, noHitter: 0, shutout: 0, completeGame: 0 }

const COMPLETE_GAME_COUNT_KEY = {
  퍼펙트: 'perfect',
  노히트: 'noHitter',
  완봉: 'shutout',
  완투: 'completeGame',
} as const

/** 완투 계열 한 번을 센다 (0xa6b54~0xa6c1a, u16 — 65535 를 넘으면 원본은 0 으로 돈다) */
export function countCompleteGame(
  career: PitcherCareer,
  kind: keyof typeof COMPLETE_GAME_COUNT_KEY | '없음',
): PitcherCareer {
  if (kind === '없음') return career
  const key = COMPLETE_GAME_COUNT_KEY[kind]
  return {
    ...career,
    completeGameCounts: { ...career.completeGameCounts, [key]: (career.completeGameCounts[key] + 1) & 0xffff },
  }
}

/** S+0x4a · +0x64 · +7 — 지난 평가 경기의 인기도·평판·사기 변화 */
export interface PitcherLastEvaluation {
  readonly popularityChange: number
  readonly reputationChange: number
  readonly moraleChange: number
}

/**
 * **116 경기 뒤 평가 창 재료** — 진입 0x1278c 의 모드 3 갈래(12a3c~12ac0)가 S+0x1d8 바이트로 짓는 기록 줄
 * `[0] 1~3 → "승리 "·"패배 "·"세이브 "(표 0xcc690) · [1]/3 "." [1]%3 "이닝 " · [3] "삼진 " · [2] "실점!N"` 과 감독 글 번호.
 */
export interface PitcherLastGame {
  /** S+0x1d8[0] — 1 승 · 2 패 · 3 세이브 · 0 없음 */
  readonly decisionCode: number
  /** [1] 잡은 아웃 */
  readonly outs: number
  /** [2] 실점 */
  readonly runs: number
  /** [3] 탈삼진 */
  readonly strikeouts: number
  /** [4] 볼넷 + 사구 (R+0x144 + R+0x148, u8) — 0x8a6fc 더티볼. 옛 저장에는 없다(0) */
  readonly walksAndHitByPitch?: number
  /** [5] 피안타 (R+0x12c, u8) — 0x8a6fc 새가슴. 옛 저장에는 없다(0) */
  readonly hitsAllowed?: number
  /** [6] 투구 수 (R+0x140, u8) — 116 감독 글 38 의 셋째 조건(12af2). 옛 저장에는 없다(0) */
  readonly pitches?: number
  /** 116 이 고른 StrUSER_EVT 감독 글 (2~37 · 38 등판 없음) */
  readonly managerCommentIndex: number
}

/** 116 기록 줄 [0] 의 글 — 표 0xcc690 → 0xcc958 · 0xcc960 · 0xcc968 */
const DECISION_LABELS: Readonly<Record<number, string>> = { 1: '승리 ', 2: '패배 ', 3: '세이브 ' }

/** 116 기록 줄 (12a3c~12ac0) — 판단 글 · `이닝 ` · `삼진 ` · `실점` */
export function pitcherLastGameLineOf(game: PitcherLastGame): string {
  const innings = `${Math.trunc(game.outs / 3)}.${game.outs % 3}`
  return `${DECISION_LABELS[game.decisionCode] ?? ''}${innings}이닝 ${game.strikeouts}삼진 ${game.runs}실점`
}

/** 비어 있는 +0x4a · +0x64 · +7 */
export const NO_LAST_EVALUATION: PitcherLastEvaluation = { popularityChange: 0, reputationChange: 0, moraleChange: 0 }

/**
 * **116 경기 뒤 평가 진입 0x1278c 의 저장 칸 몫** — S+0x50 = 2(0x1279a) 뒤, 0x8a6fc 다음의 경기 뒤 카운터(12bc2~12c3c):
 * `s16 +0x1c2 += s8 +0x4a`(이번 시즌 인기도 변화 합, `addSeasonPopularityGain`) · `0xa4d09`(평판 0 연속 +0x184). 이어하기(S+0x50 == 2)가 다시 들어오면
 * **한 번 더** 쌓인다(원본 그대로 — 타자편 `countGameForSkills` 와 같은 자리).
 * 무력감 +0x1c7 · 먹튀 +0x1c0/+0x1cd 도 같은 자리(12bc2~12c84)다 — `0xa3a75(S, 5|2)` 의 5·2 는 보유 비트 번호이고 투수 비트 0~7 은
 * 타자와 같은 공통 스킬(5 무력감 · 2 먹튀)이라 짝이 그대로다(`countSkillGameCounters`, 0x8457c 이름표 · skills.json 공통).
 */
export function enterPitcherGameEvaluation(career: PitcherCareer): PitcherCareer {
  const popularityChange = (career.lastEvaluation ?? NO_LAST_EVALUATION).popularityChange
  return {
    ...career,
    seasonEndState: 116,
    ...countSkillGameCounters(
      {
        highMoraleStreak: career.highMoraleStreak ?? 0,
        moneyGrubberGames: career.moneyGrubberGames ?? 0,
        moneyGrubberPopularityGain: career.moneyGrubberPopularityGain ?? 0,
      },
      {
        hasHelpless: hasPitcherSkill(career, HELPLESS_SKILL),
        hasMoneyGrubber: hasPitcherSkill(career, MONEY_GRUBBER_SKILL),
        morale: career.morale,
        popularityChange,
      },
    ),
    seasonPopularityGain: addSeasonPopularityGain(career.seasonPopularityGain, popularityChange),
    reputationZeroGames: countReputationZeroGame(career.reputationZeroGames, career.reputation),
  }
}

/** 공통 스킬 비트 — 무력감 · 먹튀 (투수 비트 0~7 은 타자와 같은 번호) */
const HELPLESS_SKILL = 5
const MONEY_GRUBBER_SKILL = 2

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
  /**
   * 가진 스킬 — 보유 비트 `+0x1b8`. 번호는 **투수 비트 번호 0~23** 이다 — 8 이상은 표(skills.json) 번호
   * `비트 + 16` 의 투수 스킬이다 (이름 0x8457c: 모드 3 이면 StrCOMMON[71 + 비트], `pitcherSkillTableIdOf`).
   */
  readonly skillIds: readonly number[]
  /**
   * **장착한 스킬** — 선수기록 `+0x14` 비트 (타자편 `PlayerCareer.equippedSkillIds` 와 같은 칸, H-modes 6절 "장착 칸").
   * 모드 3 의 기록은 0x1fc74 → 0x1fbd0 = `[저장+0x3c]` 다. 경기 스킬 효과(0xb62b4)·훈련(0x17f5c 의 0xa4bf8)·
   * 경기 뒤 사기(0xa741c)는 보유가 아니라 이 칸만 본다.
   */
  readonly equippedSkillIds: readonly number[]
  /** 플러스 스킬 장착 슬롯 단계 L (`P+0x1c6`, 0~2) — 상한 `[6,8,10][L]` (0xd7e8e) */
  readonly skillSlotLevel: number
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
  /**
   * 마이너스 스킬 해제 카운터 `+0x70 + 칸` (5칸, s8). 훈련 0x18a80 의 모드 3 갈래: 비겁자 18 을 **가진 채** 칸 3(체력) ·
   * 깃털 19 & 칸 2(변화) · 더티볼 20 & 칸 0(제구) 이면 그 칸 +1, 그 밖의 훈련이면 다섯 칸 모두 0.
   * 조건 21(0xadad0~)이 `> 7` 로 해제 이벤트를 연다. (`consecutiveTrainingCounts` 는 웹의 칸별 연속 수라 다르다.)
   */
  readonly releaseTrainingStreaks: readonly number[]
  /**
   * 몹쓸몸(3)·유리몸(4)을 **가진 채** 한 훈련 수 — 선수 S+0x75 · +0x76 (u8). 훈련 0x18a80 뒤 0x18b86~0x18bd6(모드 갈림 없음):
   * 보유 비트(0xa3a75)가 서 있으면 +1, 아니면 **0 으로**. 조건 21 해제가 +0x75 > 5 · +0x76 > 7 로 본다(0xad9f6 · 0xada06).
   * 옛 저장에는 없다(0).
   */
  readonly badBodyTrainings: number
  readonly fragileTrainings: number
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
  /**
   * 또또상품권 구매 수(+0x186, 상한 200) · 1등 수(+0x185) — GP 아이템 5 를 쓰는 0xa4488 이 두 모드 공용으로
   * 기록에 센다 (타자편 `PlayerCareer` 와 같은 칸). 칭호 21·22 가 본다.
   */
  readonly lotteryPurchases: number
  readonly lotteryFirstPrizes: number
  /**
   * 완투 계열 누적 — 선수 +0x1f0 u16[0..3] (퍼펙트 · 노히트 · 완봉 · 완투). 경기 뒤 인기도 0xa690c 의 선발형 승리
   * 갈래가 +0x1e0[k] 와 함께 올린다(0xa6b54~0xa6c1a). 읽는 곳: 칭호 60 철완 28호(Σ[0..3] ≥ 20, 0x1ad4e) ·
   * 칭호 63 퍼펙트 플레이어([0] > 1, 0x1aea0). 짝 칸 +0x1e0 은 읽는 곳을 못 찾아 두지 않는다.
   */
  readonly completeGameCounts: CompleteGameCounts
  readonly seasonPopularityGain: number
  /**
   * 116 경기 뒤 카운터 — +0x1c7 무력감 보유 중 "사기 ≥ 90" 연속 · +0x1cd/+0x1c0 먹튀 보유 중 경기 수/인기도 변화 합
   * (타자편 `PlayerCareer` 와 같은 칸, `countSkillGameCounters`). 스킬 조건 20·21 의 2·5 가 본다. 옛 저장에는 없다(0)
   */
  readonly highMoraleStreak?: number
  readonly moneyGrubberGames?: number
  readonly moneyGrubberPopularityGain?: number
  readonly popularityAtSeasonStart: number
  readonly hasSeenYearGoalWindow: boolean
  readonly yearGoalEventDone: boolean
  readonly endingIndex: number | null
  /** **엔딩 보너스를 받았나** — 커리어 S+0x7b (타자편 `PlayerCareer.endingBonusReceived` 와 같은 칸 · 같은 141 틀) */
  readonly endingBonusReceived?: boolean
  readonly league: League
  /**
   * **열 팀 나리 팀 레코드** (`entities/career/model/nariTeamRecord`) — 저장 블록 `[저장+0xb8] + 4 + 0x1c·팀`. 142 마선수 넣기가
   * 고친다. 옛 저장·아직 안 고친 새 선수는 없다 — `nariTeamsOf` 가 붙박이 표로 세운다. 내 팀 레코드는 투수 배열(`pitchers` —
   * 내 투수 줄 포함)도 들고 142 진입이 날마다 고친다 (`myPitcherRecord`).
   */
  readonly nariTeams?: NariTeamRecords
  /**
   * 국가대항전 대회 레코드 두 칸 — 저장 블록 [저장+0xb8] 의 +0xbc4 대표팀(내 투수 복사본이 낀 투수 배열) · +0xbe0 상대국
   * (`pitcherCupTeams`). 133 출전이 세우고 142 가 고친다. 옛 저장·대회 전에는 없다
   */
  readonly nariCupTeams?: NariCupTeams
  /**
   * **국가대항전 진행 중** — 원본 `S+0x12c`(= `L+0xac`) 플래그와 리그 구조체의 대회 칸(`L+0xa8`~`L+0xc4` · 날짜 `L+0x32`).
   * 장면 0x106 은 모드 3·4 공용이라 타자편 `PlayerCareer.nationalCup` 과 같은 자리·같은 저장 시점(133 · 463 끝 · 경기 정산)이다.
   * 새 시즌 0x1b768 이 내린다. 옛 저장에는 없다.
   */
  readonly nationalCup?: NationalCup
  readonly leaguePlayerStats: LeaguePlayerStats
  /**
   * 리그 열 팀 투수의 레코드 스태미나 `+0x2c` — 팀 번호 → 붙박이 표 칸(0~7)별 값. 없는 팀·칸은 10000. 내 투수 값은
   * `stamina` 가 든다. 경기 준비 0x1c46c 가 g == 0 이면 열 팀 10000, 경기가 깎고, 하루 끝 4f304 가 열 팀 +20%
   * (`entities/pitcher-career/model/leaguePitcherRecords`). 옛 저장에는 없다(전원 10000).
   */
  readonly leaguePitcherStaminas?: PitcherStaminaTable
  readonly regularSeasonFirstCount: number
  /** 정규시즌 우승 보상을 받았는가 S+0x77 — 128 팝업 0xb 닫힘이 켜고 새 시즌 0x1b7c0 이 지운다 (`postseasonFlow`) */
  readonly regularSeasonRewardTaken: boolean
  /**
   * 시즌 끝 사슬의 어느 상태에 들어와 있는가 — 세이브 레코드 **S+0x50(돌아온 까닭)** 의 시즌 끝 값 (타자편과 같은 칸).
   * 상태 진입마다 쓰고 곧바로 저장한다: 136 → 0xb (0x10bba) · 130 → 0xd 투수 (0x19848) · 131 → 0xe (0x19782) ·
   * 128 → 0xf (0x120ce) · 132 → 9 (0x10c60). 경기 뒤 116 진입(0x1278c)이 2, 새 시즌 0x1b768 이 1(0x1b7ba) — 웹은 둘 다 null.
   * 이어하기(상태 100 진입 0x1c154, 모드 3·4 공용)가 이 값으로 돌아간다 (`pitcherResumePointOf`).
   */
  readonly seasonEndState: SeasonEndState | null
  /**
   * 지난 평가 경기의 변화 — 원본 S 의 **+0x4a 인기도 · +0x64 평판 · +7 사기** 변화 칸. 평가 0xa719c 가 도는 정규시즌 경기만
   * 덮어쓰므로 포스트시즌 경기 뒤 116 은 앞 경기 값을 그대로 다시 읽는다(원본 그대로). 옛 저장·첫 경기 전에는 없다(0).
   */
  readonly lastEvaluation?: PitcherLastEvaluation
  /**
   * 116 경기 뒤 평가를 다시 띄울 재료 (`PitcherLastGame`) — 감독 글은 경기마다, 기록 줄 S+0x1d8 바이트는 **평가가 도는 정규시즌
   * 경기만** 덮어쓴다(0xa719c 가 유일한 쓰기 — 포스트시즌 116 은 앞 줄을 다시 읽는다). 옛 저장에는 없다
   */
  readonly lastGame?: PitcherLastGame
  /** 연속 기록 — 모드 레코드 +0x1bc u8 세 칸 (`pitcherStreaks`). 옛 저장에는 없다(0) */
  readonly streaks?: PitcherStreaks
  readonly postseason: PostseasonSeries | null
  readonly lastMidSeasonGoalCount: number
  /**
   * 평판 0 으로 끝난 경기 뒤 평가가 **연속**으로 이어진 수 (+0x184, u8) — 타자편 `PlayerCareer.reputationZeroGames` 와 같은
   * 칸·같은 셈이다. 경기 뒤 평가 116(장면 0x106, 모드 3·4 공용)의 `0xa4d08(S)`(0x12c32)가 평판 0 이면 +1, 아니면 0.
   * 칭호 30 "가짜 인간" 이 `s8 +0x184 > 4` 로 본다. 옛 저장에는 없다(0).
   */
  readonly reputationZeroGames: number
  /**
   * 중간평가(상태 117)를 본 해 — 연차idx 목록. 원본은 기록 `+0x180` 의 비트 `13 + 연차idx`(모드 3 · 타자편은 `+0`)이고
   * 보상 실행기 0x8c460 끝(0x8cbaa~0x8cbdc)이 이벤트 452~454 를 마칠 때 켠다. 105 진입(0x11bda~0x11c0c)이
   * `경기 수 == 22 && 0xa4280(기록, 타자편?, 연차idx) == 0` 일 때만 117 로 보낸다.
   */
  readonly midSeasonEvaluatedYears: readonly number[]
  /** 팀 전적 (내 팀이 치른 경기) */
  readonly wins: number
  /** 원본에 없는 칸 — 나리 경기는 무승부로 끝나지 않아(0xb68fc · 정산 4f072) 늘 0 이다. 화면은 더 읽지 않고(시즌 종료 · 상태판의 "N무" 를 걷었다) 옛 저장 호환으로 칸만 남겨 둔다 */
  readonly draws: number
  readonly losses: number
}

/** 등록 꼴 열 팀 레코드 — 타자 배열은 붙박이, 내 팀은 투수 배열에 내 투수 */
function registeredNariTeamsOf(teamId: number, role: PitcherRole): NariTeamRecords {
  return createNariTeamRecords(teamId, null).map((record, team) =>
    team === teamId ? { ...record, pitchers: registeredMyPitcherOrderOf(role) } : record)
}

export function createPitcherCareer(
  name: string,
  profile: PitcherRookieProfile = DEFAULT_PITCHER_ROOKIE_PROFILE,
): PitcherCareer {
  return {
    name,
    ability: rookiePitcherAbilityOf(profile.role, profile.typeIndex),
    role: profile.role,
    // 생성 0x17360 이 rec[+0xa] 에 0x80(bit7 = 내 육성 선수)을 쓰고, 등록 0x10fb4 가 보직대로 아래 5비트를 고친다 —
    // 선발 0 · 구원 7 (`0xb6605`, 0x111a8~0x111ae). 포지션 코드 `0xb6394` 가 그 칸이라 구원은 116 평가에서 **구원형**(> 3)이다.
    // 그 칸에 내 투수를 넣은 열 팀 레코드는 아래 `nariTeams` (`0xb521d`)
    positionCode: myPitcherRegistrationSlotOf(profile.role),
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
    // 신인 스킬은 공통 초기화 0x11230 이 0xa4bd9 로 얻는다 — 그 자리에서 자동 장착(0xa4b04(P,s,1))된다
    equippedSkillIds: STARTING_SKILL_IDS,
    // +0x1c6 을 쓰는 곳은 확장(0x148f8) 하나뿐 — 새 선수는 0 으로 본다 (타자편과 같은 추정)
    skillSlotLevel: 0,
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
    releaseTrainingStreaks: [0, 0, 0, 0, 0],
    badBodyTrainings: 0,
    fragileTrainings: 0,
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
    lotteryPurchases: 0,
    lotteryFirstPrizes: 0,
    completeGameCounts: EMPTY_COMPLETE_GAME_COUNTS,
    seasonPopularityGain: 0,
    popularityAtSeasonStart: STARTING_POPULARITY,
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    endingIndex: null,
    league: EMPTY_LEAGUE,
    // 등록 0x204e1(저장, 3, 1) 로 열 팀을 마스터에서 다시 짓고 내 팀 투수 배열 칸 t 에 내 투수 (0xb521d, `myPitcherRecord`)
    nariTeams: registeredNariTeamsOf(profile.teamId ?? DEFAULT_TEAM_ID, profile.role),
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    regularSeasonFirstCount: 0,
    regularSeasonRewardTaken: false,
    seasonEndState: null,
    streaks: EMPTY_PITCHER_STREAKS,
    postseason: null,
    lastMidSeasonGoalCount: 0,
    reputationZeroGames: 0,
    midSeasonEvaluatedYears: [],
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

/** 보유 비트(+0x1b8) — 0xa3a74. 엔딩 전설(0xa3ade)·칭호(0x1a1c0)처럼 **보유** 를 보는 곳이 쓴다 */
export function hasPitcherSkill(career: PitcherCareer, skillId: number): boolean {
  return career.skillIds.includes(skillId)
}

/**
 * 장착 비트(선수기록 +0x14) — 0xb62b4 / 0xa4bf8. 투수 경기의 스태미나 소모(0xa5e14 의 18·10)·마구 횟수
 * (0xaebe4 의 23)·실투(0x33cbc)·경기 뒤 사기 행운(0xa741c)·훈련 병아리/몹쓸몸(0x17f5c)이 이 칸을 본다.
 */
export function isPitcherSkillEquipped(career: Pick<PitcherCareer, 'equippedSkillIds'>, skillId: number): boolean {
  return isSkillEquipped(career, skillId)
}

/**
 * 장착 동작 0xa4b04(P, s, on) — 타자편 `setSkillEquipped` 를 그대로 탄다 (모드 3 도 같은 함수, 상한 0xd7e8e[P+0x1c6]).
 * ⚠️ 모드 3 은 켤 때 팀 칸 `0xb51fd(팀, 0)` 에도 켜는데(0xa4b7a) 끌 때는 기록만 끈다(0xa4b96) —
 *    그 칸이 기록(`[저장+0x3c]`)과 같은 칸인지 못 짚어 웹은 한 칸으로 둔다 (미해결, 모드 4 와 같은 물음).
 */
export function setPitcherSkillEquipped(career: PitcherCareer, skillId: number, on: boolean): PitcherCareer {
  return setSkillEquipped(career, skillId, on)
}

/** 마지막 공통 스킬 비트 — 0x8457c: 비트 ≤ 7 이면 두 편 같은 이름 */
const LAST_SHARED_SKILL_BIT = 7
/** 모드 3 은 비트 8 부터 이름 칸을 16 칸 밀어 읽는다 (StrCOMMON[0x47 + 비트] = [55 + (비트 + 16)]) */
const PITCHER_SKILL_TABLE_OFFSET = 16

/**
 * 투수 스킬 비트 → 표(skills.json·StrSKILL) 번호. 이름 함수 0x8457c(s):
 *   `s ≤ 7 → StrCOMMON[0x37 + s]` · 그 밖에 모드 4(0x7b970) 면 `[0x37 + s]`, 아니면 `[0x47 + s]`.
 */
export function pitcherSkillTableIdOf(skillBit: number): number {
  return skillBit <= LAST_SHARED_SKILL_BIT ? skillBit : skillBit + PITCHER_SKILL_TABLE_OFFSET
}

export function spendPitcherCycleAction(career: PitcherCareer): PitcherCareer {
  return { ...career, hasActedThisCycle: true }
}

/** 능력 한계 — 타자와 달리 **보직**으로 행을 고른다 (0xa44f4, R7 3절) */
export function pitcherAbilityLimitsOf(career: PitcherCareer): PitcherAbility {
  return pitcherAbilityLimitOf(career.role)
}

/**
 * 실효 능력치 스킬 보정 (0xb6414 — 0xb64b0~0xb653c). 모두 **장착** 비트 0xb62b4(선수기록 +0x14) 를 본다.
 *   5 −100 · 7 +50 은 네 칸 모두, 22 는 `0xb6278(선수)`(투수인가) 참이고 칸 0(제구)일 때만.
 *   타자 스킬 20(수비 −100)은 `0xb6278` 거짓일 때만이라 투수 레코드에는 붙지 않는다.
 */
const POWERLESS_SKILL = 5
const LEGEND_SKILL = 7
const COOL_SKILL = 22
const SKILL_PENALTY = 100
const LEGEND_BONUS = 50
/** 냉정 22: `v += v / 10` (0xb6506~0xb6510, 나눗셈 0xca7b5 = 0 쪽 버림) */
const COOL_CONTROL_DIVISOR = 10

/**
 * `0xb6414(기록, i, 1)` — 육성 선수라 마선수 배율(0xb63a0 = −1)은 건너뛰고, 원본 차례 그대로:
 *   1. 장비 니블 보너스 0xd8890[n−1] 을 더하고 999 로 자른다 (0xb6494~0xb64a8, 바닥 없음)
 *   2. 5 장착이면 −100, 0 아래면 0 (0xb64b0~0xb64c8)
 *   3. 7 장착이면 +50, 999 로 자른다 (0xb64ca~0xb64e4)
 *   4. 투수이고 22 장착이고 칸 0(제구)이면 `v += trunc(v/10)` — **자르지 않는다** (0xb64e6~0xb6510)
 *      그래서 제구는 999 를 넘을 수 있다(최대 999 + 99). 칭호 0x1ad7e 는 이 값을 `> 998` 로 보고,
 *      경기용 0xb570c 는 맨 끝(0xb5b06)에서야 0..999 로 자른다.
 */
export function equippedPitcherAbilityOf(
  career: Pick<PitcherCareer, 'ability' | 'equipmentLevels' | 'equippedSkillIds'>,
): PitcherAbility {
  const adjust = (key: keyof PitcherAbility) => {
    let value = Math.min(MAXIMUM_ABILITY, career.ability[key] + equipmentBonusOf(career.equipmentLevels[key]))
    if (isPitcherSkillEquipped(career, POWERLESS_SKILL)) value = Math.max(0, value - SKILL_PENALTY)
    if (isPitcherSkillEquipped(career, LEGEND_SKILL)) value = Math.min(MAXIMUM_ABILITY, value + LEGEND_BONUS)
    if (key === 'control' && isPitcherSkillEquipped(career, COOL_SKILL)) {
      value += Math.trunc(value / COOL_CONTROL_DIVISOR)
    }
    return value
  }
  return {
    control: adjust('control'),
    velocity: adjust('velocity'),
    breaking: adjust('breaking'),
    stamina: adjust('stamina'),
  }
}

/**
 * 경기용 실효 능력치 `0xb570c` — 0xb6414 뒤에 **질병 → 부상 → 사기 감소** 차례다 (G-1).
 * 모드 3·4 이고 내 선수(0xb6389)일 때의 갈래로, 타자편 `condition.ts` 와 같은 코드다:
 *   질병 `v += (−30·v)/100` (0xb5784) · 부상 `v += (−60·v)/100` (0xb57b4 `lsls #4; subs; lsls #2` = −60)
 */
const ILLNESS_ABILITY_CUT = 30
const INJURY_ABILITY_CUT = 60
const MORALE_ABILITY_CUTS: readonly (readonly [number, number])[] = [
  [10, 50],
  [30, 20],
  [50, 10],
]

/**
 * 0xb570c 를 체력% 피로(0xb58e6) **앞까지** 돌린 값 — 0..999 로 **아직 자르지 않았다**.
 * 원본은 피로·팀 능력치·코치까지 더한 뒤 맨 끝(0xb5b06)에서 한 번만 자르므로,
 * 피로를 따로 먹이는 투구 흐름(`fatiguedStatsOf`)은 이 값을 받아 피로 뒤에 자른다.
 * 냉정 22 로 999 를 넘은 제구가 피로로 깎일 때만 차이가 난다.
 */
export function unclampedGamePitcherAbilityOf(career: PitcherCareer): PitcherAbility {
  const moraleCut = MORALE_ABILITY_CUTS.find(([limit]) => career.morale <= limit)?.[1] ?? 0
  const equipped = equippedPitcherAbilityOf(career)
  const adjust = (key: keyof PitcherAbility) => {
    let value = equipped[key]
    if (career.isSick) value = reduceByPercent(value, ILLNESS_ABILITY_CUT)
    if (career.isInjured) value = reduceByPercent(value, INJURY_ABILITY_CUT)
    if (moraleCut > 0) value = reduceByPercent(value, moraleCut)
    return value
  }
  return {
    control: adjust('control'),
    velocity: adjust('velocity'),
    breaking: adjust('breaking'),
    stamina: adjust('stamina'),
  }
}

/** 피로 없는(체력 인자 > 54) 0xb570c — 맨 끝 0..999 자르기(0xb5b06)까지 한 값. 화면 표시용 실효값 */
export function effectivePitcherAbilityOf(career: PitcherCareer): PitcherAbility {
  const unclamped = unclampedGamePitcherAbilityOf(career)
  const adjust = (key: keyof PitcherAbility) => clamp(unclamped[key], 0, MAXIMUM_ABILITY)
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
  /** 경기 끝 0xb68fc 가 동점이면 끝을 안 내 '무' 는 오지 않는다 — 요약 꼴(`GameResult`)을 그대로 받는다 */
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
    // 정산 0x4ea0c 모드 3 → 4f020 → 4f072: 측 1 점수 > 측 0 점수 ? 측 1 승 : 측 0 승 — 무승부 갈래가 없다.
    // 경기 끝 0xb68fc 가 동점이면 끝을 안 내 경기는 늘 갈린다(웹 경기도 연장 상한이 없다 — `gameState`).
    league:
      career.postseason !== null
        ? career.league
        : recordLeagueResult(
            career.league,
            outcome.result === '승' ? outcome.ourTeamId : outcome.opponentTeamId,
            outcome.result === '승' ? outcome.opponentTeamId : outcome.ourTeamId,
          ),
    postseason:
      career.postseason === null
        ? career.postseason
        : advancePostseason(
            career.postseason,
            outcome.result === '승' ? outcome.ourTeamId : outcome.opponentTeamId,
          ),
    wins: career.wins + (outcome.result === '승' ? 1 : 0),
    losses: career.losses + (outcome.result === '승' ? 0 : 1),
  }
}

/**
 * 같은 날 나머지 네 경기 (0xc2a48) — 타자편과 같은 코드를 부른다.
 *
 * 사람 경기 준비 0x1c46c 는 g ≠ 0 이면 **상대 팀** 레코드를 0xb8c80 으로 한 칸 돌리고 내 팀은 돌리지 않는다(0xa4f60
 * 맞바꿈 — `pitcherGameFlow.ourPitcherOrderOf`). 그래서 `playLeagueDay` 에는 사람 경기 두 팀을 돌리지 말라고 하고
 * (`rotatesHumanGameTeams` 거짓) 상대만 여기서 돌린다 — 사람 경기가 본 차례(`pitcherLeagueGameSetupOf`)와 같은 칸이다.
 * 포스트시즌 경기 끝은 4f268 이 CPU 리그 경기를 건너뛰므로 하루 끝 회복만 돈다.
 */
export function applyPitcherLeagueDay(
  career: PitcherCareer,
  random: RandomPort,
  /** 전역 마선수 레벨 열 칸 `mgr[0x13a..0x143]` — CPU 끼리 경기의 마선수 배율(0xd88aa). 안 넘기면 Lv1(60%) */
  aceLevels?: Readonly<Record<number, number>>,
): PitcherCareer {
  if (career.postseason !== null) {
    return { ...career, leaguePitcherStaminas: recoveredLeagueStaminas(career.leaguePitcherStaminas ?? {}, PITCHER_EDITION_MODE) }
  }
  const day = Math.max(0, career.gamesPlayed - 1)
  const opponent = opponentOf(day, career.teamId)
  const league = cpuGameRotationAdvances(PITCHER_EDITION_MODE, day)
    ? rotateLeaguePitchers(career.league, [opponent])
    : career.league
  const played = playLeagueDay(
    league,
    day,
    career.teamId,
    random,
    career.leaguePlayerStats,
    career.leaguePitcherStaminas ?? {},
    aceLevels,
    false,
  )
  return {
    ...career,
    league: played.league,
    leaguePlayerStats: played.playerStats,
    // 하루 끝 4f304 — 열 팀 0xb617c (내 육성 선수가 아니면 +20%). 내 투수 회복은 `applyPitcherGameResult` 가 한다
    leaguePitcherStaminas: recoveredLeagueStaminas(played.pitcherStaminas, PITCHER_EDITION_MODE),
  }
}

/**
 * 오늘 경기 준비의 내 팀 몫 — 날짜 g · 보직. 0xa4f60 의 −2 는 국가대항전(S+0x12c)일 때만이라 리그 경기(포스트시즌 포함)는 거짓 —
 * 국가대항전 경기는 대표팀 칸을 따로 준비한다(`pitcherCupTeams`).
 */
function myPitcherDayOf(career: PitcherCareer): MyPitcherDay {
  return { dayCounter: leagueDayCounterOf(career), role: career.role, isNationalCup: false }
}

/**
 * 오늘 경기의 내 팀 투수 배열 — 142 진입(`prepareMyPitcherMatch`)이 넣은 레코드 그대로. 레코드에 배열이 없는 옛 저장(142 를 안
 * 거치고 곧장 경기로 가는 이어하기)은 예전 날짜 셈으로 오늘 준비까지 밟은 배열.
 */
export function todayMyPitcherOrderOf(career: PitcherCareer): readonly number[] {
  return recordedMyPitcherOrderOf(career) ?? legacyMyPitcherOrderOf(myPitcherDayOf(career), true)
}

/**
 * **142 진입 0x1c46c 의 내 팀 몫** — 마선수 넣기와 같은 문(장면+0x288 · 이전 상태 143) 안에서 한 번: 내 팀 투수 배열을 오늘
 * 준비대로 고치고(`prepareMyPitcherOrder`), 포지션 코드를 새 칸으로(0xb8768), g == 0 이면 내 +0x2c = 10000(0x1c8a8).
 */
export function prepareMyPitcherMatch(career: PitcherCareer): PitcherCareer {
  const day = myPitcherDayOf(career)
  const before = recordedMyPitcherOrderOf(career) ?? legacyMyPitcherOrderOf(day, false)
  const order = prepareMyPitcherOrder(before, day)
  return {
    ...career,
    nariTeams: withMyPitcherOrder(career, order),
    positionCode: myPitcherPositionCodeOf(order),
    ...(day.dayCounter === 0 ? { stamina: FULL_STAMINA } : {}),
  }
}

/**
 * 사람 경기 준비 `0x1c46c` 가 세운 투수 — 상대 팀 레코드 차례(0번 선발 · 벤치 차례)와 양 팀 칸별 `+0x2c`.
 * `PitcherGameOptions` 에 그대로 얹는다. 내 팀 차례는 진행기가 0xa4f60 맞바꿈으로 세운다.
 */
export function pitcherLeagueGameSetupOf(
  career: PitcherCareer,
  opponentTeamId: number,
): {
  readonly opponentPitcherOrder: readonly number[]
  /** 내 팀 투수 배열 — 진행기 칸 번호(내 투수 = 표 밖 8). 142 진입이 오늘 준비를 레코드에 넣은 뒤의 차례 (`myPitcherRecord`) */
  readonly ourPitcherOrder: readonly number[]
  /** 내 투수 포지션 코드 `0xb6394` = 그 배열 안 내 칸 (116 평가의 ≤3 선발형 판정) */
  readonly positionCode: number
  /** g == 0 이면 0x1c8a8 이 내 팀 레코드도 10000 으로 채운다 — 내 투수 +0x2c */
  readonly stamina?: number
  readonly ourPitcherStaminas?: readonly number[]
  readonly opponentPitcherStaminas?: readonly number[]
} {
  const day = leagueDayCounterOf(career)
  const ourPitcherStaminas = humanGamePitcherStaminasOf(career, day, career.teamId)
  const opponentPitcherStaminas = humanGamePitcherStaminasOf(career, day, opponentTeamId)
  const order = todayMyPitcherOrderOf(career)
  return {
    opponentPitcherOrder: humanGamePitcherOrderOf(career, PITCHER_EDITION_MODE, day, opponentTeamId),
    ourPitcherOrder: gameMyPitcherOrderOf(order),
    positionCode: myPitcherPositionCodeOf(order),
    ...(day === 0 ? { stamina: FULL_STAMINA } : {}),
    ...(ourPitcherStaminas === undefined ? {} : { ourPitcherStaminas }),
    ...(opponentPitcherStaminas === undefined ? {} : { opponentPitcherStaminas }),
  }
}

/**
 * 사람 경기 끝 두 팀 투수 레코드 +0x2c 를 리그 표에 되적는다 — `before` 는 경기 **전** 커리어(g 를 본다), `after` 는
 * `applyPitcherGameResult` 를 지난 커리어다.
 */
/**
 * 사람 경기의 CPU 투수 줄(내 투수 빼고)과 경기 끝 판정을 리그 기록표에 쌓는다 — 정규시즌 경기만 (`recordHumanGamePitchers`).
 * `before` 는 경기 **전** 커리어다(포스트시즌인지 본다).
 */
export function withPitcherGameLeagueRecords(
  before: PitcherCareer,
  after: PitcherCareer,
  pitchers: GameLeaguePitchers | undefined,
): PitcherCareer {
  const leaguePlayerStats = recordHumanGamePitchers(after.leaguePlayerStats, pitchers, before.postseason === null)
  return leaguePlayerStats === after.leaguePlayerStats ? after : { ...after, leaguePlayerStats }
}

export function withPitcherGameStaminas(
  before: PitcherCareer,
  after: PitcherCareer,
  ourTeamId: number,
  opponentTeamId: number,
  /** 경기 끝 표 (`PitcherGameSummary.pitcherStaminas`). 없으면(진행기를 안 거친 요약) 표를 그대로 둔다 */
  staminas: { readonly ours: readonly number[]; readonly opponent: readonly number[] } | undefined,
): PitcherCareer {
  if (staminas === undefined) return after
  return {
    ...after,
    leaguePitcherStaminas: staminaTableAfterHumanGame(before, leagueDayCounterOf(before), [
      { teamId: ourTeamId, staminas: staminas.ours },
      { teamId: opponentTeamId, staminas: staminas.opponent },
    ]),
  }
}

/** 45경기가 끝나면 정규시즌을 닫는다 (0xb818c) */
export function applyPitcherSeasonEnd(career: PitcherCareer): PitcherCareer {
  if (career.postseason !== null || career.gamesPlayed < GAMES_PER_SEASON) return career
  const result = finishRegularSeason(career.league, career.teamId)
  return {
    ...career,
    regularSeasonFirstCount: career.regularSeasonFirstCount + (result.isRegularSeasonFirst ? 1 : 0),
    // 대진 0xb80a8 — 정규시즌 끝 투수 레코드 차례를 그대로 들고 간다 (포스트시즌 선발·벤치 차례의 바탕)
    postseason: startPostseason(result.ranking, career.league.pitcherOrders),
  }
}

/** 포스트시즌을 내 차례까지 진행한다 (0x13da0) */
export function applyPitcherPostseasonProgress(
  career: PitcherCareer,
  random: RandomPort,
  /** 전역 마선수 레벨 열 칸 — 안 넘기면 Lv1(60%) */
  aceLevels?: Readonly<Record<number, number>>,
): PitcherCareer {
  if (career.postseason === null) return career
  // CPU 끼리 경기(0xc2760)는 리그 표의 +0x2c 로 서고 깎인 값을 남긴다 — 회복은 없다
  const result = runCpuPostseasonWithStamina(
    career.postseason,
    career.teamId,
    random,
    career.leaguePitcherStaminas ?? {},
    aceLevels,
  )
  return result.series === career.postseason
    ? career
    : { ...career, postseason: result.series, leaguePitcherStaminas: result.pitcherStaminas }
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
  // 0x1b768 → 0x1b852 `0x1b684` — 보직 2 가 아니면 내 투수를 레코드 0번으로 (레코드에 배열이 있을 때만 — 옛 저장은 142 가 세운다)
  const recorded = recordedMyPitcherOrderOf(career)
  const order = recorded === null ? null : moveMyPitcherToStart(recorded, career.role)
  return {
    // 0x1b768 의 1b774 `S+0x12c = 0` — 국가대항전 플래그를 내린다
    ...endNationalCup(career),
    ...(order === null ? {} : { nariTeams: withMyPitcherOrder(career, order), positionCode: myPitcherPositionCodeOf(order) }),
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
    // 승패는 비우되 **투수 레코드 차례는 잇는다** (`nextSeasonLeague` — 새 시즌 처리는 팀 저장 레코드를 다시 짓지 않는다).
    // 레코드 +0x2c 는 첫 경기 준비(g == 0)가 열 팀 10000 으로 채운다
    league: nextSeasonLeague(
      career.postseason === null
        ? career.league.pitcherOrders
        : pitcherOrdersAfterPostseason(career.postseason, career.league.pitcherOrders),
    ),
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    postseason: null,
    regularSeasonRewardTaken: false,
    // 0x1b7ba `S[0x50] = 1` — 시즌 끝 사슬을 벗어난다
    seasonEndState: null,
    // 0x1b882 `memset(S+0x1bc, 0, 4)` — 연속 기록 세 칸을 지운다
    streaks: EMPTY_PITCHER_STREAKS,
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
