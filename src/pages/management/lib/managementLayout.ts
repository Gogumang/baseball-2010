/**
 * 관리 화면 원본 배치 (binary.mod 0x7d34c 상태판 · 0x7e418 커맨드 줄 — layout-re 명세, 바이트 확인).
 * 머리띠·바닥띠(0x54d94)는 widgets/screen-frame 이 그린다. 소프트키·안내 줄은 원본에 없다.
 */
export {
  COMMAND_LABEL_HEIGHT,
  COMMAND_LABEL_OFFSET_Y,
  COMMAND_MENUS,
  COMMAND_SLOTS,
  COMMAND_SLOT_SIZE,
  PARENT_SLOT_TARGET,
  commandLabelAlignOf,
  commandLabelLeftOf,
  type ManagementCommand,
  type MenuSlot,
  type SubMenuKind,
} from './managementLayout/commandMenu'
export { commandSlotYAt, sineOf, slidePositionAt } from './managementLayout/slideMotion'
export {
  BOARD_COLOR,
  BOARD_POLYGON,
  MESSAGE_COLORS,
  MORALE_GAUGE_BACKGROUND,
  MORALE_LABEL_FRAME,
  NAME_BAND,
  STADIUM_BAND,
  STATUS_BOXES,
  STATUS_ICON_STEP,
  backgroundFrameOf,
  moraleGaugeColumnsOf,
  moraleGaugeFrameOf,
  nameBandSplitOf,
  type Box,
} from './managementLayout/statusBoard'
export { messageGameNumberOf, messageLineLayoutOf } from './managementLayout/messageLine'
export { GLYPH_SPACING, SLASH_FRAME, glyphsWidthOf, moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
