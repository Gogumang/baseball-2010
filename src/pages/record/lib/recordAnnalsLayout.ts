/**
 * 기록연감 배치 (메인 메뉴 상태 30, 그리기 0x2e29c~0x2fc12 — P6 2c 확정).
 *
 * ```
 * 창 = 공용 판 (24, 54, 192, 212) · x0 = W/2 − 96 = 24 · y0 = H/2 − 106 = 54
 * 탭 막대 = slt_frame 프레임 4 + 탭 (192×19) 을 (24, H/2 − 108 = 52)
 * 탭 커서 = 프레임 9 (72×17)
 * ```
 * 그림은 모두 `ui/slt_frame.pzx`(this+0x9c)와 `ui/num.pzx`, 전역 `img_text` 다.
 */

export {
  PAGER,
  PAGE_TITLE,
  PANEL,
  TAB_BAR,
  TAB_COUNT,
  TAB_CURSOR,
  TAB_ICON_STEP,
  TAB_ICON_WIDTH,
  TAB_NAMES,
  TAB_NAME_FRAMES,
  TAB_NAME_Y,
  TAB_PAGE_COUNTS,
  TAB_SELECTED_GAP,
  TAB_SELECTED_WIDTH,
  TAB_SLOT_BOX_XS,
  TAB_SLOT_HEIGHT,
  TAB_SLOT_WIDTH,
  tabIconWidthOf,
  tabIconXOf,
  tabNameXOf,
  tabSlotXOf,
} from '@/pages/record/lib/recordAnnalsLayout/annalsTabs'
export {
  CELL_FRAMES,
  CELL_GRID,
  LOCKED_MARK,
  NAME_ROW,
  SCROLL_MARKS,
  TOTAL_ROW,
  cellPositionOf,
} from '@/pages/record/lib/recordAnnalsLayout/annalsCells'
export {
  ENDING_CELL_NAMES,
  NARI_ENDING_CELL_COUNT,
  PROGRESS_ROW,
  SEASON_ENDING_CELL_COUNT,
  endingCellFrameOf,
  endingProgressOf,
} from '@/pages/record/lib/recordAnnalsLayout/annalsProgress'
export { SKILL_BADGE, SKILL_DESCRIPTION, SKILL_NOT_GAINED_TEXT, skillGradeOf } from '@/pages/record/lib/recordAnnalsLayout/annalsSkill'
export {
  LIST_CURSOR,
  LIST_GRID,
  LIST_NAME,
  LIST_ROW_FRAME_DY,
  SPECIAL_RECORD_FIRST_CELL,
  SPECIAL_RECORD_NAMES,
  STAT_LIST_FIRST_Y,
  STAT_NAME,
  STAT_VALUE,
  listFirstYOf,
  listRowFrameOf,
} from '@/pages/record/lib/recordAnnalsLayout/annalsList'
export {
  ACHIEVEMENT_MARK,
  DESCRIPTION_BAR,
  DESCRIPTION_TICKER,
  NICKNAME_SCROLLBAR,
  NICKNAME_TAB_LABEL,
  RECORD_COUNT,
  tickerTextXOf,
} from '@/pages/record/lib/recordAnnalsLayout/annalsMarks'
