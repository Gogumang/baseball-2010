import { BALANCE } from '@/shared/config/original/balance'

/** 원본 능력치 상한 (0xb6414 가 999 로 자른다) */
export const MAXIMUM_ABILITY = BALANCE.ability.maximum

/**
 * 관리 메뉴가 열리는 주기.
 * 원작 설명서 원문: "2경기마다 관리 메뉴가 발생하며 다음 커맨드로 선수를 육성합니다."
 * (StrHOWTO[11], r_event_txt[172])
 */
export const GAMES_PER_MANAGEMENT_CYCLE = BALANCE.season.gamesPerManagementCycle

/** 한 시즌 경기 수. 원작 설명서 StrHOWTO[10]: "1년에 총 45경기의 정규리그를 진행하며" */
export const GAMES_PER_SEASON = BALANCE.season.gamesPerSeason

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
export const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT
/** 신인 스킬 — 0 병아리 · 8 의외성 (0x11230 에서 a4bd9 두 번) */
export const STARTING_SKILL_IDS: readonly number[] = BALANCE.rookie.skillIds

/**
 * 인기도·평판 상한. 원본 칭호 조건에 "평판 999 달성", "인기도 4000이상 달성" 이 있다 (StrNICKNAME[91][71]).
 * 이벤트 보상 점프 표(binary.mod 0xd4e50)도 인기도를 9999, 평판을 999 로 자른다 (점검 에이전트 정적 확인).
 */
export const MAXIMUM_POPULARITY = BALANCE.limits.popularity
export const MAXIMUM_REPUTATION = BALANCE.limits.reputation
export const MAXIMUM_MORALE = BALANCE.limits.morale

/** 기본 소속 팀 — 서울 드래곤즈 */
export const DEFAULT_TEAM_ID = 0

/** G포인트 상한 (저장+0x64) */
export const MAXIMUM_GAME_POINT = BALANCE.limits.gamePoint
export const STARTING_GAME_POINT = BALANCE.rookie.gamePoint
