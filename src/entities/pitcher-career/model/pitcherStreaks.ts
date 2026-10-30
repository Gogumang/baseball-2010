/**
 * **투수편 연속 기록** — 모드 레코드 `+0x1bc` u8 세 칸 잇기(0xa719c)와 116 진입의 알림 줄 · 보상 명령(0x8a6fc).
 *
 * 공개 이름 모음 — 하위 폴더 (`pitcherStreaks/`): `streakCounts`(칸 잇기 0xa719c) · `streakEvent`(알림 줄 · 평판 0x8a6fc) ·
 * `streakSkillRewards`(집중 · 새가슴 · 더티볼 스킬 명령)
 */
export { advancePitcherStreaks, EMPTY_PITCHER_STREAKS } from '@/entities/pitcher-career/model/pitcherStreaks/streakCounts'
export type { PitcherStreaks } from '@/entities/pitcher-career/model/pitcherStreaks/streakCounts'
export { pitcherStreakEventOf, pitcherStreakEventOfCareer, pitcherStreakMarkupOf } from '@/entities/pitcher-career/model/pitcherStreaks/streakEvent'
export type { PitcherStreakEventInput } from '@/entities/pitcher-career/model/pitcherStreaks/streakEvent'
