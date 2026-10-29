/**
 * 시즌모드 이벤트(s_event) — 고르기 · 판정 · 보상 (장면 0x105 의 **이벤트 재생 0xd3** 앞뒤).
 *
 * 근거는 원본을 직접 떴다 (P4 2a·2b · A 1~3절을 대조해 고친 곳은 각 함수 주석에 적었다):
 *
 * ```
 * 0xe9ac  갱신 — 상태가 **막 바뀐 틀에만**(0xbc9c8 이 참) ① 상태별 진입 함수 ② 이벤트 폴링을 돈다
 *         (e9c2~e9cc: 바뀌지 않았으면 ec6a 로 건너뜀 — 관리 메뉴에 머무는 동안 매 틀 굴리지 않는다)
 * eb74    현재 상태가 0xc9(관리 메뉴) 또는 0xd1(외출 지도)일 때:
 *           this+0xf9(새 선수) → 0x8bde0(모드 2 → 400) · [이전 0xc9, 다음 0xd3] · 플래그 지움
 *           다음 상태 == 0xd4(연초 목표) → 건너뜀
 *           0x8be80(관리자, 모드, 화면코드 = 현재 상태, SR, SR+0x80) → 0xadc70 고르기
 *             찾으면 [이전 = 현재 상태, 다음 0xd3]
 * ```
 * 화면코드는 상태 번호 그대로라 관리 메뉴 = **201**, 외출 지도 = **209** 다.
 *
 * 공개 이름 모음 — 하위 폴더 (`seasonEventFlow/`): `ids`(화면코드 · 이벤트 번호) · `seen`(본 비트) · `judge/`(판정 0xacfbc · 조건 0xad1ba) ·
 * `select/`(고르기 0xadc70 · 폴링) · `yearGoal`(내장 연초 목표 0x8a680) · `reward/`(보상 0x8c460 · 연차 보정 0x8d508) · `illness`(질병 ·
 * 사기 감소) · `afterGame`(경기 끝 꼬리 · 이어 트는 이벤트)
 */
export {
  EVENT_100_ID,
  ILLNESS_EVENT_ID,
  NATIONAL_CUP_INTRO_EVENT_ID,
  OPENING_EVENT_ID,
  SEASON_EVENT_AUDIENCE,
  SEASON_FINAL_EVENT_ID,
  SEASON_GOAL_INTRO_EVENT_ID,
  SEASON_SCREEN_CODE,
  YEAR_GOAL_EVENT_ID,
  pollsSeasonEvents,
  seasonScreenCodeOf,
} from '@/entities/season-mode/model/seasonEventFlow/ids'
export { clearRepeatableSeen, hasSeenEvent, markEventSeen } from '@/entities/season-mode/model/seasonEventFlow/seen'
export { illnessChancePercentOf } from '@/entities/season-mode/model/seasonEventFlow/judge/conditions'
export { isInSeasonEventWindow, judgeSeasonEvent } from '@/entities/season-mode/model/seasonEventFlow/judge/judgeEvent'
export {
  START_SEASON_EVENT_CURSOR,
  cursorAfterCalling,
  selectSeasonEvent,
  type SeasonEventCursor,
} from '@/entities/season-mode/model/seasonEventFlow/select/cursor'
export { pollSeasonEvents } from '@/entities/season-mode/model/seasonEventFlow/select/poll'
export {
  SEASON_GOAL_WINDOW_SUB,
  SEASON_PLAYABLE_EVENTS,
  YEAR_GOAL_EVENT,
  opensSeasonGoalWindow,
} from '@/entities/season-mode/model/seasonEventFlow/yearGoal'
export { seasonRewardsIn, withSeasonYearAdjust, type SeasonEventReward } from '@/entities/season-mode/model/seasonEventFlow/reward/rewards'
export { applySeasonEventRewards } from '@/entities/season-mode/model/seasonEventFlow/reward/applyRewards'
export {
  HOSPITAL_CURE_THRESHOLD,
  ILLNESS_ABILITY_PENALTY_PERCENT,
  ILLNESS_COOLDOWN,
  ILLNESS_KIND_COUNT,
  ILLNESS_SLACK_ON_CATCH,
  cureIllnessAtHospital,
  cureIllnessByItem,
  illnessPenaltyFieldOf,
  moralePenaltyOf,
} from '@/entities/season-mode/model/seasonEventFlow/illness'
export { seasonEventFollowUpOf, tickAfterAnyGame } from '@/entities/season-mode/model/seasonEventFlow/afterGame'
