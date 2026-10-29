/**
 * 이벤트 명령 **system sub 1 — 올해의 목표 창** (0x8d304 · 그리기 0x8a351 → 0x86fdc). 원본 흐름은 `yearGoalWindow/goalWindowSpec` 머리말.
 * 공개 이름 모음 — 하위 폴더 (`yearGoalWindow/`): `goalWindowSpec`(박스 · 그림 번호 · 값 꼴) · `goalPieces`(글 · 숫자 · 타율 0x8633c ·
 * 방어율 0x86248 한 칸 자리) · `goalTable`(0x8656c 표 한 벌 · 창 한 장)
 */
export {
  SEASON_YEAR_GOAL_LABEL_SET,
  SYSTEM_YEAR_GOAL_WINDOW,
  YEAR_GOAL_BOXES,
  YEAR_GOAL_MODE_UI_FRAME,
  type SeasonYearGoalWindowValues,
  type YearGoalNumberPiece,
  type YearGoalTextPiece,
  type YearGoalWindowSource,
} from '@/pages/story/lib/yearGoalWindow/goalWindowSpec'
export {
  YEAR_GOAL_PERCENT_FRAME,
  averageGlyphsOf,
  earnedRunAverageGlyphsOf,
  placedNumberOf,
  placedTextOf,
} from '@/pages/story/lib/yearGoalWindow/goalPieces'
export { goalTableLayoutOf, yearGoalWindowLayoutOf } from '@/pages/story/lib/yearGoalWindow/goalTable'
