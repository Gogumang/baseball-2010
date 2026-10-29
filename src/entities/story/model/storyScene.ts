/**
 * 나리 타자편 **이벤트 일정** — 원작 r_event 레코드를 커서로 훑어 지금 볼 이벤트를 고르고(0xadc70 · 판정 0xacfbc),
 * 보상 명령 뒤 본 표시 · 행동함 · 이어하기 자리(0x8c460 끝)를 고친다.
 *
 * 공개 이름 모음 — 하위 폴더 (`storyScene/`): `schedule`(trigger · 오프닝 · 분기 전용 번호) · `illness`(조건 22 확률 0xadb32 ·
 * 쿨다운 ② 0xad00e) · `conditions`(조건 switch 0xad1ba) · `eligibility`(날짜 창 · 선행 B-33 · 판정 0xacfbc) · `scan`(훑기 0xadc70 ·
 * 오프닝 0xae170) · `seenEvents`(반복 풀기 0xacf60 · 보상 뒤 0x8c460 · 외출 갈래 0x8b12c) · `resumePatch`(S+0x50 8cc2e · 연봉 0x8cac0 ·
 * 0x1c154) · `yearStartEvent`(연초 115 0x8a680) · `otherSlices`(다른 조각)
 */
export { EVENT_TRIGGER, OPENING_EVENT_ID, branchOnlyEventIds, placeTriggerOf } from '@/entities/story/model/storyScene/schedule'
export { illnessChanceOf, isIllnessCooldownBlocked } from '@/entities/story/model/storyScene/illness'
export { requiredEventIdOf } from '@/entities/story/model/storyScene/eligibility'
export { nextEventFor, openingScanOf, scanEventFrom } from '@/entities/story/model/storyScene/scan'
export { finishEvent, forgetRepeatableEvents, markRewardedEvent, withOutingEventActed } from '@/entities/story/model/storyScene/seenEvents'
export { nariSeasonEndStateOfResumeCode, rewardItemsResumeCodeOf, rewardResumePatchOf } from '@/entities/story/model/storyScene/resumePatch'
export { NARI_YEAR_START_EVENT, NARI_YEAR_START_EVENT_ID } from '@/entities/story/model/storyScene/yearStartEvent'
