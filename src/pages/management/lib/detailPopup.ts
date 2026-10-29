/**
 * 상세정보 결과 창 (0x8a0a4 → 0x872d4, layout-re 3차 — 좌표 바이트 확인).
 * 훈련·휴식·GP 아이템 뒤에 뜬다. 값은 0x872a0(현재, 최대, 변화, 보너스) 다섯 줄 × 네 칸으로 넘긴다
 * (창 +0x284 + 16i 에 차례로 — 0x872a0 디스어셈 확정). 두 모드 공용 창이다.
 */
export {
  CHANGE_ARROW_FRAMES,
  DETAIL_CHANGE_X,
  DETAIL_CURRENT_DX,
  DETAIL_HEADER,
  DETAIL_LABEL_BOX,
  DETAIL_MAXIMUM_DX,
  DETAIL_MESSAGE_LINE_HEIGHT,
  DETAIL_ROW_TOP,
  DETAIL_SLASH_FRAME,
  DETAIL_TABLE_FRAME,
  DETAIL_TITLE_FRAME,
  DETAIL_VALUE_BOX,
  DETAIL_WINDOW,
  DETAIL_Y_OFFSET,
  detailMessageBoxOf,
  detailRowTopOf,
} from './detailPopup/detailWindow'
export { DETAIL_SCROLL_BAR_COLORS, detailScrollBarOf, type ScrollBarRect } from './detailPopup/scrollBar'
export {
  BATTER_DETAIL_LABEL_FRAMES,
  PITCHER_DETAIL_LABEL_FRAMES,
  detailRowsFromSlots,
  detailRowsOf,
  restDetailChangesOf,
  trainingDetailChangesOf,
  type DetailResult,
  type DetailRow,
  type DetailSlots,
  type DetailView,
} from './detailPopup/detailRows'
export { gpItemDetailChangesOf } from './detailPopup/gpItemChanges'
