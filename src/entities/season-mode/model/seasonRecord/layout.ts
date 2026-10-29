import { TEAMS } from '@/shared/config/original/teams'
import type { SeasonDayBoard } from '@/entities/season-mode/model/seasonRecord/types'

export const zeros = (length: number) => Array.from({ length }, () => 0)
export const falses = (length: number) => Array.from({ length }, () => false)

/** SR+0x1c0 한 줄 수 — 하루 다섯 경기 */
export const DAY_BOARD_SIZE = 5

/**
 * 아직 한 번도 복사되지 않은 점수표. 레코드가 처음 만들어질 때의 값은 문서에 없어 **0 으로 둔다(유력 —
 * 저장 초기화가 레코드를 0 으로 채운다고 본다)**. 이 판은 정규시즌 경기 직후(0xf1)에만 그려지고 그 경기 끝이
 * 먼저 복사하므로 화면에는 닿지 않는다.
 */
export function emptySeasonDayBoard(): SeasonDayBoard {
  return {
    teamsA: zeros(DAY_BOARD_SIZE),
    teamsB: zeros(DAY_BOARD_SIZE),
    scoresA: zeros(DAY_BOARD_SIZE),
    scoresB: zeros(DAY_BOARD_SIZE),
  }
}

/** 한 해 정규시즌 경기 수 (StrHOWTO[10] "1년에 총 45경기") */
export const SEASON_GAME_COUNT = 45
/** 관리 메뉴는 경기 수가 짝수일 때만 열린다 (P4 1b, StrHOWTO[18] "2경기마다") */
export const MANAGEMENT_CYCLE = 2
/** 10년차(연차 idx 9)가 마지막 해다 (0xa3084) */
export const FINAL_YEAR_INDEX = 9

/** SR+2 소지금 상한 (0x8182·0x14b2c 의 9999 클램프) */
export const MONEY_LIMIT = 9999
/** SR+0x48 인기도 상한 */
export const POPULARITY_LIMIT = 9999
/** SR+0x62 평판 상한 */
export const REPUTATION_LIMIT = 999
/** 팀 레코드 +2 사기 상한 */
export const MORALE_LIMIT = 100
/** 팀 능력치 4칸 상한 (0xb6414 가 999 로 자른다) */
export const TEAM_ABILITY_LIMIT = 999

/** 구장 아이템 보유 플래그는 3종 × 7칸 = 21바이트다 (S3 2절) */
export const STADIUM_OWNED_SIZE = 21
/** 평판 기록은 16바이트를 memset 한다 (0xa3424) */
export const GAME_RECORD_SIZE = 16
/** 지금 장착한 구장 아이템 3칸 — 관중석·전광판·잔디 (SR+0x1b8·0x1b9·0x1ba) */
export const STADIUM_EQUIPPED_SIZE = 3
/** SR+0x185 의 "코치 없음" 값 (s8 −1, J 4-2) — `gameAbilities.NO_COACH` 와 같은 값이다 */
export const NO_COACH = -1
/** 트레이닝 서브 아이템 칸 수 — 능력치 4칸 (0x58~0x5b) */
export const TRAINING_SUB_ITEM_SIZE = 4
/** 외출 서브 아이템 칸 수 — 장소 5곳 (0x5d~0x61) */
export const OUTING_SUB_ITEM_SIZE = 5

/** 원본과 같은 자르기 — 값을 [0, limit] 안으로 */
export function clampTo(value: number, limit: number): number {
  if (value > limit) return limit
  if (value < 0) return 0
  return value
}

/** XlsTEAM_DATA 한 줄의 u16 6개 중 뒤 4개가 팀 능력치다 (앞 둘은 id·100) */
const TEAM_ABILITY_OFFSET = 2

/** 리그 10팀의 시작 능력치 — XlsTEAM_DATA 값 그대로 (J-4: 새 시즌이 손대지 않는다) */
export function initialTeamAbilities(): number[][] {
  return TEAMS.slice(0, 10).map((team) => team.values.slice(TEAM_ABILITY_OFFSET).map((value) => value))
}
