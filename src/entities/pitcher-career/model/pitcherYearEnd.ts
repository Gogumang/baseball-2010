/**
 * 나만의리그 **투수편**(모드 3) 연말 이벤트 사슬 — 시즌 끝 상태 기계 0x1cdec 의 136 → 130 → 131 → 132.
 *
 * ```
 *   136 (0x10bb0)  392 올해의 목표 → 0x8d0e0: k = 0xa3de8(career, 0) → 393(5) · 394(4) · 395(3) · 396(그 밖)
 *   130 (0x19824)  0x8dad4 타이틀 → 370 → 0x8b04c: 371 + 수상 수 (372 +3 · 373 +6 · 374 +10 소지금)
 *   131 (0x19774)  0x8dd60 MVP 판정(비트 career+0x1ca) → 375 → 0x8b370: 377(MVP) / 376
 *   132 (0x10c54)  연말 — 판정 == 1 → 501 · 연차idx == 12 → 504 · idx > 5 → 502 · 그 밖 380
 *   380 → 381 강경 / 382 정중 → 0x8d058: k = 0xa4d78 → 384~387 / 388~391 · 383 수락
 *   502 → 380 / 496 → 380 / 503
 * ```
 * (B-season-awards.md B-1 · "시즌 끝 상태 순서" · 5a. 상태 함수는 모드 3·4 공용이고, 0x8b04c·0x8b370 의
 * 나만의리그 갈래도 모드 3·4 를 가르지 않는다.)
 *
 * 이 파일은 **순수 함수**만 둔다 — 이벤트 재생·화면은 세션 몫이다. 쓰는 법:
 *   1. 정규시즌·포스트시즌이 끝나면 `nextPitcherYearEndStep(career, [])` → 392 부터.
 *   2. 이벤트에 **들어갈 때** `enterPitcherYearEndEvent` (375 는 그 앞에서 MVP 비트를 남긴다 — 상태 131).
 *   3. 이벤트가 **끝날 때** `finishPitcherYearEndEvent` (그 이벤트의 보상 명령 7 을 원본대로).
 *      선택지(380·502·496)는 이벤트 데이터의 `gotoEvent` 가 잇는다 — 본 번호를 `viewed` 에 쌓는다.
 *   4. 사슬이 끊기면(선택지 없이 끝난 이벤트) 본 번호 전부로 `nextPitcherYearEndStep` 을 다시 부른다.
 *
 * 사이 상태 (R9 확정):
 *   - **114** = 이벤트 재생(진입 0x11d00 · 키 0x13b88 · 틀 0x1c014). 각 상태가 `[다음 114, 뒤 X]` 로 이벤트를 틀고,
 *     끝나면 뒤 상태 X 로 간다. 뒤가 132 면 새 시즌 0x1b768 → 137 → 105. 웹 투수편은 `StoryScreen` 이 이 자리다.
 *   - **128** = 포스트시즌 대진(진입 0x120a4 · 키 0x13da0 · 틀 0x15984) — 131 과 132 사이. 사슬은 `'포스트시즌'` 걸음을
 *     내고, 세션이 공용 모델 `postseasonFlow` 로 128 을 돌린 뒤 본 번호에 `PITCHER_POSTSEASON_STEP_ID` 를 얹어
 *     다시 부르면 132 로 간다. 대진이 없으면(정규시즌이 안 닫힘) 곧장 132.
 *   - **133** = 국가대표 선발(0x1a090) — 132 가 연차idx 짝수면 뒤 상태로 넣는다. 사슬 밖이라 세션이 잇는다
 *     (`achievedPitcherGoalCount(career, '국가대표')` → 461/462).
 */
/*
 * 공개 이름 모음 — 하위 폴더 (`pitcherYearEnd/`): `chain`(본 번호 → 다음 걸음 · 이벤트 진입 상태) ·
 * `resume`(이어하기 0x1c154) · `rewards`(이벤트 끝 보상 명령 7)
 */
export {
  enterPitcherYearEndEvent,
  nextPitcherYearEndStep,
  PITCHER_POSTSEASON_STEP_ID,
  pitcherYearEndEventIdOf,
} from '@/entities/pitcher-career/model/pitcherYearEnd/chain'
export { pitcherResumePointOf } from '@/entities/pitcher-career/model/pitcherYearEnd/resume'
export type { PitcherResumePoint } from '@/entities/pitcher-career/model/pitcherYearEnd/resume'
export { finishPitcherYearEndEvent, pitcherYearEndRewardsOf } from '@/entities/pitcher-career/model/pitcherYearEnd/rewards'
