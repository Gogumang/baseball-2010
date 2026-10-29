/**
 * 스페셜 목록 배치 (메인 메뉴 상태 6 — P6 2d).
 *
 * 그리기 = 메뉴 판 `0x24b1c`(반원 바퀴, F-5) + **하위 목록 `0x2524c`** + 머리띠 `0x54d95(skin, 0, 5)`
 * (제목 "2010프로야구", 바닥 되돌아가기 — P6 1-1).
 *
 * 항목 그림은 `mainui/main_ui.pzx` 의 **프레임**이고 상태 6 의 표는 `0xceb2f` 다 (여덟 칸, 확정).
 * 칸 차례는 갱신 표 `0xceb88`(하위 상태 24~31)·설명 `StrMAINMENU[16]~[23]` 과 같다.
 */

export { ITEM_COUNT, SCREEN, SPECIAL_ITEMS, SPECIAL_REEL_STATE } from '@/pages/special/lib/specialLayout/specialItems'
export { FOOTER, HEADBAND } from '@/pages/special/lib/specialLayout/specialBands'
export {
  HALL_OF_FAME_CELL_ART,
  HALL_OF_FAME_GRID,
  HALL_OF_FAME_SLOTS,
  HOME_RUN_DERBY_FIRST_ROW_Y,
  hallOfFameCellImageTopLeftOf,
  hallOfFameCellImagesOf,
  hallOfFameCellOf,
  isHallOfFameCellDimmed,
} from '@/pages/special/lib/specialLayout/hallOfFameCells'
export {
  HALL_OF_FAME_PITCHER_SLOTS,
  NARI_BATTER_SLOT,
  NARI_PITCHER_SLOT,
  hallOfFameEntryOfSlot,
  hallOfFameKeyCodeOf,
} from '@/pages/special/lib/specialLayout/hallOfFameSlots'
export type { HallOfFameSlotState } from '@/pages/special/lib/specialLayout/hallOfFameSlots'
export {
  HALL_OF_FAME_BUBBLE,
  HALL_OF_FAME_CHART,
  HALL_OF_FAME_CHART_MAXIMUM_LENGTH,
  HALL_OF_FAME_DETAIL,
  HALL_OF_FAME_SLOT_ART,
  HALL_OF_FAME_TAGS,
  SLT_FRAME,
  hallOfFameBubblePositionOf,
  hallOfFameChartVerticesOf,
} from '@/pages/special/lib/specialLayout/hallOfFameDetail'
