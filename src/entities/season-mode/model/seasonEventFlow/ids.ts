import { SEASON_SCENE_STATE, type SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'

/** 이벤트 폴링이 쓰는 화면 코드 (= 상태 번호) */
export const SEASON_SCREEN_CODE = {
  관리메뉴: 201,
  외출지도: 209,
} as const

/** 시즌모드(모드 2)가 받는 대상 — 판정 0xacfbc 의 ad008 `cmp r0,#4` */
export const SEASON_EVENT_AUDIENCE = 4
/** 오프닝 — 새 선수 플래그로 0x8bde0 이 튼다 (모드 2) */
export const OPENING_EVENT_ID = 400
/** 20경기 축하 — G +1000, 전역 저장 +0xbe 로 기기당 한 번 */
export const EVENT_100_ID = 100
/** 질병 유행 */
export const ILLNESS_EVENT_ID = 490
/** 올해의 목표 확인 (0xee 0x6d6c) */
export const SEASON_GOAL_INTRO_EVENT_ID = 392
/** 국가대항전 개막 (0xf2 0xe5f8) */
export const NATIONAL_CUP_INTRO_EVENT_ID = 461
/** 10년 종료 (새 해 0x6e0c 의 엔딩 갈래) */
export const SEASON_FINAL_EVENT_ID = 500

/** 연초 목표 0xd4 가 메모리에 만드는 내장 이벤트의 웹 번호 — s_event 에 없는 번호(0)를 쓴다 */
export const YEAR_GOAL_EVENT_ID = 0

/** 이벤트 폴링이 도는 상태 (0xeb74~0xeb7c) */
export function pollsSeasonEvents(state: SeasonSceneState): boolean {
  return state === SEASON_SCENE_STATE.관리메뉴 || state === SEASON_SCENE_STATE.외출지도
}

/** 폴링 화면코드 — 상태 번호 그대로 */
export function seasonScreenCodeOf(state: SeasonSceneState): number {
  return state
}
