/**
 * 환경설정 창 배치 (공용 페이지 0x593c8 종류 8 · 메인 메뉴 상태 8 — P6 5절 확정).
 *
 * 기준 (0x59436~0x594a4):
 * ```
 * x0 = W/2 − 96 = 24 · x1 = W/2 − 86 = 34 · hh = 212 · y0 = H/2 − hh/2 = 54
 * 창 = 공용 판 (24, 54, 192, 212)
 * 줄 i = 0..5 → Y_i = y0 − 5 + 25·i = 49 + 25i
 * ```
 * 그림은 `img_text` 가 아니라 **`ui/slt_frame.pzx`** 다 (F-8 의 img_text 표기는 잘못 읽은 것).
 * 제목만 img_text 프레임 289 "기본 설정"(46×10) 을 쓴다.
 */

export {
  FIRST_MENU_ROW,
  ICON_BACK_SIZE,
  MENU_ROW,
  PANEL,
  ROW_COUNT,
  ROW_ICONS,
  ROW_ICON_IMAGES,
  SCREEN,
  SOUND_OFF_ICON,
  TITLE,
  VALUE_ROW,
  VIBRATION_ON_ICON,
  iconCenterOffsetOf,
  rowTopOf,
} from '@/pages/settings/lib/settingsLayout/settingsRows'
export {
  IN_GAME_PANEL,
  IN_GAME_ROW_COUNT,
  OK_BUTTON,
  OK_SELECTED_FRAME,
  OK_SELECTED_OVERFLOW,
  SOUND_BARS,
  SPEED_MARKS,
  VIBRATION,
  okButtonTopOf,
  soundBarAt,
  speedMarkAt,
} from '@/pages/settings/lib/settingsLayout/settingsValues'
export {
  DETAIL_CHOICES,
  DETAIL_COLORS,
  DETAIL_ROW,
  DETAIL_ROWS,
  DETAIL_ROW_COUNT,
  DETAIL_TITLE,
  MODE_RESET_ROW,
  MODE_RESET_ROW_COUNT,
  MODE_RESET_TITLE,
  ROW_SHAKE_TABLES,
  SETTINGS_FRAME,
  detailRowTopOf,
  detailValueOutlineOf,
  isSelectedOutlineShown,
  modeResetRowTopOf,
} from '@/pages/settings/lib/settingsLayout/settingsSubPages'
export { PANEL_UNFOLD_START_HEIGHT, closingFold, nextPanelFold, openingFold, panelClipOf } from '@/pages/settings/lib/settingsLayout/settingsFold'
export type { PanelFold } from '@/pages/settings/lib/settingsLayout/settingsFold'
export { DETAIL_DESCRIPTIONS, MAIN_MENU_CURSOR_COUNT, SETTINGS_DESCRIPTIONS } from '@/pages/settings/lib/settingsLayout/settingsDescriptions'
