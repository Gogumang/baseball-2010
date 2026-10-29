import { ORIGINAL_COLORS } from '@/shared/config/design'
import { timeSlotOfHour } from '@/shared/lib/phoneClock/phoneClock'

/** 계단형 배경판 (설정자 0x76704: top 35, height 190, offset 30 → 식 0x7650c) */
export const BOARD_POLYGON = '0,54 141,54 160,35 240,35 240,206 160,206 141,225 0,225'
export const BOARD_COLOR = { fill: ORIGINAL_COLORS.boardFill, edge: ORIGINAL_COLORS.boardEdge, highlight: ORIGINAL_COLORS.boardHighlight }

/** 경기장 띠 — f10 박스0 검정, mode_back 프레임을 (1,66) 에 70 높이로 자른다 (0x7b9ac) */
export const STADIUM_BAND = { top: 65, height: 72, imageLeft: 1, imageTop: 66, imageHeight: 70 }

/**
 * 이름·칭호 띠 (0x7cfc8) — 띠 = 프레임 10 박스 1 ∪ 박스 2, 꺾이는 자리(셋째 인자)는 0x7d43c~0x7d464:
 * `W/2 − (0x7b998 시즌 ? 0x1c : 0x2d)` → 나만의리그 75 · 시즌모드 92 (`nameBandSplitOf`).
 */
export const NAME_BAND = {
  top: 136,
  height: 20,
  split: 75,
  nameBox: { x: 0, width: 81 },
  titleBox: { x: 92, width: 148 },
  colors: { outer: ORIGINAL_COLORS.bandDark, inner: ORIGINAL_COLORS.panelDeep, light: ORIGINAL_COLORS.bandLight },
}

export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** mode_ui 프레임 11 의 박스 (값 칸 파란 막대 네 개는 그 프레임 그림에 있다) */
export const STATUS_BOXES = {
  moraleLabel: { x: 160, y: 41, width: 33, height: 15 },
  moraleGauge: { x: 194, y: 41, width: 41, height: 15 },
  labels: [
    { x: 28, y: 164, width: 30, height: 10, frame: 327 },
    { x: 123, y: 163, width: 32, height: 11, frame: 302 },
    { x: 30, y: 183, width: 28, height: 10, frame: 331 },
    { x: 124, y: 182, width: 31, height: 12, frame: 332 },
  ],
  popularity: { x: 60, y: 161, width: 58, height: 15 },
  money: { x: 157, y: 161, width: 58, height: 15 },
  reputation: { x: 60, y: 180, width: 58, height: 15 },
  salary: { x: 157, y: 180, width: 58, height: 15 },
  message: { x: 0, y: 206, width: 105, height: 15 },
  statusIcons: { x: 4, y: 45, width: 20, height: 19 },
} as const
export const MORALE_LABEL_FRAME = 84
export const MESSAGE_COLORS = { fill: ORIGINAL_COLORS.bandDark, edge: ORIGINAL_COLORS.messageLineEdge }
export const MORALE_GAUGE_BACKGROUND = ORIGINAL_COLORS.gaugeBackground
/** 상태 아이콘 줄 전진 = 박스 폭 20 + 2 (0x7ddb6). 아이콘 번호·조건은 `ui/StatusIconRow` */
export const STATUS_ICON_STEP = 22

const SCREEN_WIDTH = 240
const MAXIMUM_MORALE = 100
const GAUGE_COLUMN_COUNT = STATUS_BOXES.moraleGauge.width - 1

export function moraleGaugeColumnsOf(morale: number): number {
  return Math.trunc((Math.max(0, morale) * GAUGE_COLUMN_COUNT) / MAXIMUM_MORALE)
}

/** 1×13 게이지 열 그림 — mode_ui 12 빨강 · 13 주황 · 14 초록 */
export function moraleGaugeFrameOf(morale: number): number {
  if (morale <= 30) return 12
  if (morale <= 74) return 13
  return 14
}

/** 이름 띠가 꺾이는 x — 0x7d43c: 시즌(모드 2)이면 W/2 − 0x1c, 아니면 W/2 − 0x2d */
export function nameBandSplitOf(isSeasonMode: boolean): number {
  return SCREEN_WIDTH / 2 - (isSeasonMode ? 0x1c : 0x2d)
}

/** 경기장 띠 프레임 = 시간대 [this+0x1c] — 한국 시각으로 0xb8fbd 를 친다 (`timeSlotOfHour`) */
export function backgroundFrameOf(hour: number): number {
  return timeSlotOfHour(hour)
}
