/**
 * **미션 HUD — 원본 `0x36714`** (타자 미션 모드 6 · 투수 미션 모드 5). 원본 흐름은 `missionHudLayout/hudPanel` 머리말.
 * 공개 이름 모음 — 하위 폴더 (`missionHudLayout/`): `hudPanel`(판 · 머리 아이콘 · 띠 반투명) · `hudCounter`(숫자 "a/b" 0x3608c) ·
 * `goalCounts`(줄 글 → 지금/목표 0x36358) · `goalLines`(목표 줄 자리 · 넘김 자르기) · `limitStrips`(타석 · 스윙/투구 띠 · 캔버스 띠) ·
 * `hudTimer`(시계 0x361e4)
 */
export { MISSION_HUD_BASE, missionHudIconOf, type HudSprite, type MissionHudMode } from '@/pages/mission-play/lib/missionHudLayout/hudPanel'
export { COUNTER_BASE, slashCounterGlyphsOf, type HudGlyph } from '@/pages/mission-play/lib/missionHudLayout/hudCounter'
export { goalCountOf, pitcherGoalCountOf } from '@/pages/mission-play/lib/missionHudLayout/goalCounts'
export { COUNTER_CLIP, GOAL_TEXT_WIDTH, TEXT_CLIP, goalLineDrawsOf, type ClipRect } from '@/pages/mission-play/lib/missionHudLayout/goalLines'
export { limitStripsOf, missionStageStripsOf, type MissionLimitState } from '@/pages/mission-play/lib/missionHudLayout/limitStrips'
export { TIMER_ICON, TIMER_STRIP, timerGlyphsOf } from '@/pages/mission-play/lib/missionHudLayout/hudTimer'
