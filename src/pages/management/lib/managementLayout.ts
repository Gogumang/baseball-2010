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

/**
 * 이름표 정렬 — 0x7e418 이 0x7e300 에 넘기는 정렬 (0x7e666~0x7e67e 직접 떴다):
 * ```
 * [gfx+0x15c](하위 메뉴) ≠ 0 && 칸 > 1 && 칸 ≠ 4 → 0x21(왼쪽) ; 그 밖 0x22(가운데)
 * ```
 * 하위 메뉴의 칸 2·3 만 칸 왼끝에 붙는다(원본 그대로 — 칸 4 는 다시 가운데).
 */
export const COMMAND_LABEL_ALIGN = { left: 0x21, center: 0x22 } as const

export function commandLabelAlignOf(isSubMenu: boolean, index: number): number {
  return isSubMenu && index > 1 && index !== 4 ? COMMAND_LABEL_ALIGN.left : COMMAND_LABEL_ALIGN.center
}

/** 이름표 그림 왼쪽 — 그림은 테두리 1px 을 둘러 글자보다 1px 왼쪽에서 시작한다 */
export function commandLabelLeftOf(slotX: number, labelWidth: number, align: number): number {
  const glyphLeft = align === COMMAND_LABEL_ALIGN.left ? slotX : slotX + Math.trunc((COMMAND_SLOT_SIZE - labelWidth) / 2)
  return glyphLeft - 1
}

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

/** 숫자 글자 배치는 공용 모듈을 쓴다 (shared/lib/pixelNumber) */
export type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'
export { GLYPH_SPACING, SLASH_FRAME, glyphsWidthOf, moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'


/** 이름 띠가 꺾이는 x — 0x7d43c: 시즌(모드 2)이면 W/2 − 0x1c, 아니면 W/2 − 0x2d */
export function nameBandSplitOf(isSeasonMode: boolean): number {
  return SCREEN_WIDTH / 2 - (isSeasonMode ? 0x1c : 0x2d)
}

/**
 * 메시지줄 "N년 G/45경기" 의 경기 번호 — 0x7d120 (직접 떴다, 모드 갈림 없음 — 0x7b998 을 부르지만 값을 버린다):
 * ```
 * g = (s8)S+0xb2 (= L+0x32 날짜 카운터)
 * g == 0 && S+0xb4(포스트시즌) ≠ 0 → 45 ; 그 밖 g + 1
 * 0x7d34c 의 둘째 인자 ≠ 0 이고 위 값 > 1 → −1        ; 이벤트 대화창 0x8b5ac 만 [이벤트+0xb] 를 넘긴다(그 밖 0)
 * ```
 * 포스트시즌에는 g 가 그 시리즈에서 치른 경기 수라 "3/45경기" 처럼 시리즈 차례가 나온다 — 원본 그대로.
 * 45 는 자르지 않는다(정규시즌 g == 45 면 46).
 */
export function messageGameNumberOf(dayCounter: number, isPostseason: boolean, isPreviousGame = false): number {
  const game = dayCounter === 0 && isPostseason ? GAMES_PER_SEASON : dayCounter + 1
  return isPreviousGame && game > 1 ? game - 1 : game
}

/**
 * 메시지줄 배치 — 0x7d120 이 박스 10 (0,206,105,15) 오른쪽 끝에서 dx 를 줄여 가며 오른쪽부터 그린다.
 * ```
 * dx = −5 ; "경기"(img_text 335) 0xb9e05(정렬 0x24, ox dx)      ; dx −= 폭 + 2
 * 45      0xba719(자간 1, 기준 20, 정렬 0x24, ox dx)          ; dx −= 2·폭(num 20) + 4
 * "/"     0xb9d35(num 127, 정렬 0x24, ox dx, **oy 1**)        ; dx −= 폭 + 2
 * G       0xba719(…, ox dx)                                   ; dx −= 자리수·폭(num 20) + 7
 * "년"(334) 0xb9e05(정렬 0x24, ox dx)                          ; dx −= 폭 + 2
 * N       0xba719(…, ox dx)
 * ```
 * "/" 는 0xb9c5c 라 세로 가운데가 내림 `trunc((15 − 8)/2) = 3` 에 oy 1 → y = 210.
 */
export interface MessageLineLayout {
  readonly gameLabelLeft: number
  readonly totalRight: number
  readonly slashLeft: number
  readonly slashTop: number
  readonly gameRight: number
  readonly yearLabelLeft: number
  readonly yearRight: number
  /** "경기" · "년" 글 위 — 0xb9e05 정렬 0x24 의 세로 가운데 올림((h − 10) / 2) */
  readonly labelTop: number
}

const MESSAGE_GAME_LABEL_WIDTH = 19
const MESSAGE_YEAR_LABEL_WIDTH = 9
const MESSAGE_SLASH = { width: 5, height: 8, oy: 1 }
const MESSAGE_DIGIT_WIDTH = 6
const MESSAGE_LABEL_HEIGHT = 10

export function messageLineLayoutOf(game: number, box: Box = STATUS_BOXES.message): MessageLineLayout {
  const right = box.x + box.width
  let dx = -5
  const gameLabelLeft = right + dx - MESSAGE_GAME_LABEL_WIDTH
  dx -= MESSAGE_GAME_LABEL_WIDTH + 2
  const totalRight = right + dx
  dx -= 2 * MESSAGE_DIGIT_WIDTH + 4
  const slashLeft = right + dx - MESSAGE_SLASH.width
  const slashTop = box.y + Math.trunc((box.height - MESSAGE_SLASH.height) / 2) + MESSAGE_SLASH.oy
  dx -= MESSAGE_SLASH.width + 2
  const gameRight = right + dx
  dx -= String(game).length * MESSAGE_DIGIT_WIDTH + 7
  const yearLabelLeft = right + dx - MESSAGE_YEAR_LABEL_WIDTH
  dx -= MESSAGE_YEAR_LABEL_WIDTH + 2
  const labelGap = box.height - MESSAGE_LABEL_HEIGHT
  const labelTop = box.y + (labelGap >> 1) + (labelGap % 2)
  return { gameLabelLeft, totalRight, slashLeft, slashTop, gameRight, yearLabelLeft, yearRight: right + dx, labelTop }
}

/** 경기장 띠 프레임 — 휴대폰 시각 기준 (this+0x1c) */
export function backgroundFrameOf(hour: number): number {
  if (hour >= 6 && hour <= 15) return 0
  if (hour >= 16 && hour <= 19) return 1
  return 2
}
