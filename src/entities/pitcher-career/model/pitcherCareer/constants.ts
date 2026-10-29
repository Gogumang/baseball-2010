import { BALANCE } from '@/shared/config/original/balance'
import { MAXIMUM_PITCHER_ABILITY } from '@/entities/pitcher-career/model/pitcherAbility'

/** 능력치 상한 (0xb6414 가 999 로 자른다) */
export const MAXIMUM_ABILITY = MAXIMUM_PITCHER_ABILITY
export const MAXIMUM_MORALE = BALANCE.limits.morale
export const MAXIMUM_POPULARITY = BALANCE.limits.popularity
export const MAXIMUM_REPUTATION = BALANCE.limits.reputation
export const MAXIMUM_GAME_POINT = BALANCE.limits.gamePoint
/** 원본 소지금·연봉 한 칸 = 100만원 */
export const ORIGINAL_MONEY_UNIT = BALANCE.money.unit
export const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT

/** 관리 메뉴 주기 · 한 시즌 경기 수 — 타자편과 같다 (StrHOWTO[10][11]) */
export const GAMES_PER_MANAGEMENT_CYCLE = BALANCE.season.gamesPerManagementCycle
export const GAMES_PER_SEASON = BALANCE.season.gamesPerSeason

/** 신인 시작값 — 나만의리그 공통 초기화 0x11244~0x11296 (타자편과 같은 코드다) */
export const STARTING_POPULARITY = BALANCE.rookie.popularity
export const STARTING_REPUTATION = BALANCE.rookie.reputation
export const STARTING_MORALE = BALANCE.rookie.morale
export const STARTING_SALARY = BALANCE.rookie.salary
export const STARTING_MONEY = BALANCE.rookie.money
export const STARTING_GAME_POINT = BALANCE.rookie.gamePoint
/** 신인 스킬 — 0 병아리 · 8 의외성 (0x11230). 투수편도 같은 초기화를 지난다 */
export const STARTING_SKILL_IDS: readonly number[] = BALANCE.rookie.skillIds

/** 기본 소속 팀 — 서울 드래곤즈 */
export const DEFAULT_TEAM_ID = 0

/** 구질 훈련 칸 수 — 4계열 × 2줄 (커리어 +0x208 + (행·2 + 열%2)·4 + 1, J 3-2) */
export const PITCH_TRAINING_CELL_COUNT = 8
/** 히든 변화구 계열 수 (커리어 +0x204+행) */
export const HIDDEN_PITCH_ROW_COUNT = 4
