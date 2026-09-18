import { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 관리 화면 원본 배치 (binary.mod 0x7d34c 상태판 · 0x7e418 커맨드 줄 — layout-re 명세, 바이트 확인).
 * 머리띠·바닥띠(0x54d94)는 widgets/screen-frame 이 그린다. 소프트키·안내 줄은 원본에 없다.
 */
export type ManagementCommand = '선수정보' | '트레이닝' | '휴식' | '외출' | '아이템' | '다음경기'

export interface MenuSlot {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly icon: number
  readonly labelFrame: number
}

/** 하위 메뉴 칸 (표 0xd4758) */
const SUB_SLOT_POSITIONS: readonly (readonly [number, number])[] = [[44, 245], [82, 245], [122, 236], [161, 236], [199, 236]]

function subMenu(entries: readonly (readonly [string, number, number])[]): readonly MenuSlot[] {
  return entries.map(([id, icon, labelFrame], index) => ({
    id,
    x: SUB_SLOT_POSITIONS[index][0],
    y: SUB_SLOT_POSITIONS[index][1],
    icon,
    labelFrame,
  }))
}

export type SubMenuKind = '선수정보' | '트레이닝' | '아이템'

/** 하위 메뉴 (0x7e84c — 아이콘 표 +0x178, 이름표 표 +0x17c) */
export const COMMAND_MENUS: Readonly<Record<SubMenuKind, readonly MenuSlot[]>> = {
  선수정보: subMenu([['기본정보', 6, 96], ['장비착용', 7, 228], ['아이템/스킬', 8, 101], ['필살타법', 15, 115], ['기록실', 9, 297]]),
  트레이닝: subMenu([['히트', 11, 98], ['파워', 12, 103], ['수비', 13, 108], ['주루', 14, 113], ['필살타법', 15, 115]]),
  아이템: subMenu([['장착', 7, 100], ['서브', 8, 105], ['GP', 20, 110]]),
}

/** 사인표 0xd310c — round(100·sin θ), θ = 0~90 */
const SINE_TABLE = [
  0, 2, 3, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21, 22, 24, 26, 28, 29, 31, 33, 34, 36, 37, 39, 41, 42, 44, 45, 47, 48,
  50, 52, 53, 54, 56, 57, 59, 60, 62, 63, 64, 66, 67, 68, 69, 71, 72, 73, 74, 75, 77, 78, 79, 80, 81, 82, 83, 84,
  85, 86, 87, 87, 88, 89, 90, 91, 91, 92, 93, 93, 94, 95, 95, 96, 96, 97, 97, 97, 98, 98, 98, 99, 99, 99, 99, 100,
  100, 100, 100, 100, 100,
]

/** 0x6c6a8 — 음수면 +360, 180 초과면 −sin(θ−180), 90 초과면 sin(180−θ) */
export function sineOf(degrees: number): number {
  let angle = degrees
  while (angle < 0) angle += 360
  angle %= 360
  if (angle > 180) return -sineOf(angle - 180)
  if (angle > 90) return SINE_TABLE[180 - angle]
  return SINE_TABLE[angle]
}

const SLIDE_START_Y = 170
const SLIDE_DEGREES_PER_UPDATE = 16
const SLIDE_LAST_DEGREES = 110

/** 사인 곡선 이동 (0x7ff8c) — start 에서 target 으로, t = 시작 뒤 갱신 수. 조금 넘친 뒤 선다 */
export function slidePositionAt(start: number, target: number, updates: number): number {
  const range = target - start
  const base = range - Math.trunc(((updates === 0 ? sineOf(90) : sineOf(SLIDE_LAST_DEGREES)) * range) / 100)
  return Math.trunc((sineOf(Math.min(SLIDE_DEGREES_PER_UPDATE * updates, SLIDE_LAST_DEGREES)) * range) / 100) + base + start
}

/** 커맨드 칸 등장 — y170 에서 내려온다 */
export function commandSlotYAt(targetY: number, updates: number): number {
  return slidePositionAt(SLIDE_START_Y, targetY, updates)
}

/** 하위 메뉴가 열리면 부모 칸이 첫 메인 칸 자리(표 0xd4740[0])로 간다 (0x8003c) */
export const PARENT_SLOT_TARGET = { x: 6, y: 245 }

/** 칸 32×32. 좌3·우3 계단형 (표 0xd4740 · 초기화 0x7b590) — 아이콘 mode_icon 0~5 (표 0xd4868) */
export const COMMAND_SLOTS: readonly MenuSlot[] = [
  { id: '선수정보', x: 6, y: 245, icon: 0, labelFrame: 90 },
  { id: '트레이닝', x: 44, y: 245, icon: 1, labelFrame: 91 },
  { id: '휴식', x: 82, y: 245, icon: 2, labelFrame: 92 },
  { id: '외출', x: 122, y: 236, icon: 3, labelFrame: 93 },
  { id: '아이템', x: 161, y: 236, icon: 4, labelFrame: 94 },
  { id: '다음경기', x: 199, y: 236, icon: 5, labelFrame: 89 },
]
export const COMMAND_SLOT_SIZE = 32
/** 이름표 칸 (x, y+34, 32, 12) 가운데 */
export const COMMAND_LABEL_OFFSET_Y = 34
export const COMMAND_LABEL_HEIGHT = 12

/** 계단형 배경판 (설정자 0x76704: top 35, height 190, offset 30 → 식 0x7650c) */
export const BOARD_POLYGON = '0,54 141,54 160,35 240,35 240,206 160,206 141,225 0,225'
export const BOARD_COLOR = { fill: ORIGINAL_COLORS.boardFill, edge: ORIGINAL_COLORS.boardEdge, highlight: ORIGINAL_COLORS.boardHighlight }

/** 경기장 띠 — f10 박스0 검정, mode_back 프레임을 (1,66) 에 70 높이로 자른다 (0x7b9ac) */
export const STADIUM_BAND = { top: 65, height: 72, imageLeft: 1, imageTop: 66, imageHeight: 70 }

/** 이름·칭호 띠 (0x7cfc8) */
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
export const STATUS_ICON_STEP = 22
/** 상태 아이콘 mode_ui 프레임 — 효과 남은 경기 · 부상 · 질병 (필드 뜻은 추정) */
export const STATUS_ICON_FRAMES = { effect: 85, injury: 86, illness: 88 }

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

/** 숫자 글자 배치는 공용 모듈을 쓴다 (shared/lib/pixelNumber) */
export type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'
export { GLYPH_SPACING, SLASH_FRAME, glyphsWidthOf, moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'


/** 경기 번호 = 치른 경기 + 1, 시즌을 다 치렀으면 45 (0x7d120) */
export function seasonGameOf(gamesPlayed: number): number {
  return Math.min(gamesPlayed + 1, GAMES_PER_SEASON)
}

/** 경기장 띠 프레임 — 휴대폰 시각 기준 (this+0x1c) */
export function backgroundFrameOf(hour: number): number {
  if (hour >= 6 && hour <= 15) return 0
  if (hour >= 16 && hour <= 19) return 1
  return 2
}
