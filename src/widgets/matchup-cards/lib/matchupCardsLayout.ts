/**
 * **투수·타자 소개 판 — 원본 `0x44944` (직접 떴다, 0x44944~0x45786)**.
 *
 * 경기 상태 0xe(투수 등판·확인)의 그리기 `0x4d9ec` 는 0xd 그리기 `0x4db2c` 와 같은 여섯 함수
 * (0x38d1c · 0x49e64 · 0x35b94 · 0xbe6a0 · 0x42f2c · 0x4c4bc)를 부른 뒤 **이 함수 하나**를 더 부른다(0x4da20).
 * 0x44944 를 부르는 곳은 0x4d9ec 하나뿐이고 안에 모드(+0x1104) 검사가 없다 — **모든 모드의 상태 0xe** 가 같은 판을 그린다.
 * 그리는 것은 판 두 장이고, 문자열 표(Str*)의 문구는 하나도 없다 — 글은 선수 이름(0xb62c0)뿐, 나머지는 그림 글자다.
 *
 * ```
 * 밀림   a0 = 틱 == 0 ? 90 : 110 · a1 = min(틱 × 16, 110) · S(a) = (0x6c7c0 sin×65535(a) × 0x8c) >> 16
 *        o = S(a0) − S(a1)                           ; 틱 0·1·2·… → 139·93·57·27·6·−6·−8·0·0…  (살짝 넘쳤다 돌아온다)
 * 손     h = 0xb63c0(지금 타자 0xae89c([장면+0x220]))   ; 1 좌타 · 0 우타
 *        투수 판 기준 = h ? W + o − 0x8c : −o · 타자 판 기준 = h ? −o : W + o − 0x8c
 * 쪽     s = (s8)장면+0x17e1 (적재 8 이 0xb63c0(모드 타자)로 넣는다, 0x4887e) — s > 0 이면 투수 +5·타자 −3, 아니면 투수 −3·타자 +3
 * 투수 판 (game_ui 프레임 1, 위 = H − 0xe6)          타자 판 (game_ui 프레임 2, 위 = H − 0x5f)
 *   박스 0 둥글기 5 검정 · (+1,+1,−2,−2) #335FCD   ; 0xba0bc (두 판 같다)
 *   프레임을 (x, y) 에 두 번 (0xba19c — 그림이 불투명이라 한 번과 같다)
 *   박스 1  img_text 157 PLAYER / 158 COM (0xb6c20(st, st[0xa]) == 1 → COM) · 색 4 · 정렬 0x11
 *   박스 3  이름 0xb62c0 · 흰색 · 정렬 0x24 (0xba4c0)
 *   박스 7  보직 0x545e8(0xb6704 = +0xb & 3): 0 선발 → game_ui 4 + img_text 49 · 1 중계 → 7 + 170 · 2 구원 → 5 + 182
 *   박스 8  0xb63c0(투수) ? 54 좌완 : 55 우완
 *   박스 4  316 "방어" · 박스 11 방어율 정수 · 박스 10 소수 두 자리 · 점 (박스11 오른끝 + 1, 아래 − 3, 1×2) 흰색
 *   박스 5  317 "삼진" · 박스 6 탈삼진 (+0x26, 자간 1)
 *   박스 9  체력 막대 (`staminaGaugeRectsOf`)
 *                                                    박스 1  PLAYER / COM (st[9])
 *                                                    박스 2  타순 +0x32 + 1 (num 30~, 자간 1, 정렬 2)
 *                                                    박스 3  이름 · 박스 7 수비 0x54590(+0x1c & 0xf) (글자 y + 1)
 *                                                    박스 8  56 좌타 / 57 우타 · 박스 4 318 "타율" · 박스 11 타율 · 점
 *                                                    박스 5  180 "홈런" · 박스 6 홈런(+0x28) · 박스 10 319 "타점" · 박스 9 타점(+0x2a)
 *                                                    판 아래 오늘 타석 기록 마지막 4칸 (`recentResultChipsOf`)
 * ```
 * 박스는 `public/sprites/game_ui/frames/boxes.json`("001"·"002"), 그림 크기는 각 `origins.json` 그대로다.
 * 숫자 글자는 num.pzx 그림 20~29(주황, 6×10 · "1" 만 4×10)와 30~39(타순)다.
 */
import { sineSixteen } from '@/shared/lib/math/originalTrigonometry'

export interface CardBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const box = (x: number, y: number, width: number, height: number): CardBox => ({ x, y, width, height })

/** 타석 화면 W × H (0x14008b8 · 0x14008c8) */
export const MATCHUP_SCREEN = { width: 240, height: 320 } as const

/** 밀림 폭·판 기준 폭 0x8c (0x4496e `movs r4,#0x8c`) */
export const SLIDE_DISTANCE = 0x8c

/** 판 위 = H − 0xe6 (투수, 0x44a6a) · H − 0x5f (타자, 0x45134) */
export const PITCHER_CARD_TOP = MATCHUP_SCREEN.height - 0xe6
export const BATTER_CARD_TOP = MATCHUP_SCREEN.height - 0x5f

/** game_ui 프레임 1 박스 0~11 — 투수 판 */
export const PITCHER_BOXES: readonly CardBox[] = [
  box(0, 0, 137, 62), box(7, 4, 37, 7), box(65, 6, 17, 13), box(84, 6, 49, 13),
  box(8, 25, 23, 12), box(8, 44, 22, 12), box(34, 43, 30, 13), box(75, 23, 26, 13),
  box(106, 24, 27, 13), box(75, 43, 56, 13), box(48, 24, 16, 13), box(36, 24, 11, 13),
]

/** game_ui 프레임 2 박스 0~11 — 타자 판 */
export const BATTER_BOXES: readonly CardBox[] = [
  box(0, 0, 137, 62), box(7, 4, 37, 7), box(65, 7, 17, 13), box(84, 6, 49, 13),
  box(8, 25, 23, 12), box(8, 44, 22, 12), box(34, 43, 30, 13), box(75, 23, 26, 13),
  box(106, 24, 27, 13), box(104, 43, 29, 13), box(78, 43, 22, 13), box(43, 24, 21, 13),
]

export const GAME_UI_FOLDER = './sprites/game_ui/frames'
export const IMG_TEXT_FOLDER = './sprites/img_text/frames'
export const NUM_FOLDER = './sprites/num'

/** 판 바탕 그림 — game_ui 프레임 1(투수) · 2(타자) */
export const PITCHER_CARD_FRAME = 1
export const BATTER_CARD_FRAME = 2

/** 프레임 크기 — `[+0xe]`·`[+0x10]`(그림이 놓이는 원점) · `[+0x12]`·`[+0x14]`(폭·높이) = origins.json 의 x·y·width·height */
export interface FrameSize {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const frame = (width: number, height: number, x = 0, y = 0): FrameSize => ({ x, y, width, height })

/** game_ui 프레임 크기 (쓰는 것만) */
export const GAME_UI_FRAMES: Readonly<Record<number, FrameSize>> = {
  0: frame(79, 46),
  1: frame(135, 56, 1, 1),
  2: frame(135, 56, 1, 1),
  4: frame(27, 15),
  5: frame(27, 15),
  7: frame(27, 15),
  69: frame(32, 15),
  70: frame(32, 15),
  71: frame(32, 15),
}

/** img_text 프레임 크기 (쓰는 것만) */
export const IMG_TEXT_FRAMES: Readonly<Record<number, FrameSize>> = {
  49: frame(20, 10), 54: frame(21, 10), 55: frame(21, 10), 56: frame(21, 10), 57: frame(21, 10),
  58: frame(21, 10), 59: frame(28, 10), 60: frame(28, 10), 61: frame(20, 10),
  157: frame(39, 5), 158: frame(20, 5), 170: frame(21, 10), 173: frame(15, 10, 2), 174: frame(17, 10),
  175: frame(17, 10), 176: frame(21, 10), 177: frame(19, 10), 178: frame(20, 10), 179: frame(20, 10),
  180: frame(20, 10), 181: frame(21, 10), 182: frame(21, 10), 183: frame(20, 10), 184: frame(20, 11),
  316: frame(20, 10), 317: frame(21, 10), 318: frame(21, 10), 319: frame(21, 10), 361: frame(21, 10), 362: frame(21, 10),
}

/** num 그림 크기 — 20~29 · 30~39 모두 6×10, "1"(21 · 31)만 4×10 */
export const numImageWidthOf = (image: number): number => (image % 10 === 1 ? 4 : 6)
export const NUM_IMAGE_HEIGHT = 10

/** img_text 글자 프레임 번호 */
export const LABEL = {
  player: 157,
  computer: 158,
  leftPitcher: 54,
  rightPitcher: 55,
  leftBatter: 56,
  rightBatter: 57,
  /** 316 "방어" (0x44d02 `0x9e << 3` = 0x4f0 / 4) */
  earnedRun: 316,
  /** 317 "삼진" (0x44e44 0x4f4 / 4) */
  strikeout: 317,
  /** 318 "타율" (0x45370 `0x9f << 3` = 0x4f8 / 4) */
  average: 318,
  /** 180 "홈런" (0x45542 `0xb4 << 2` = 0x2d0 / 4) */
  homeRun: 180,
  /** 319 "타점" (0x455aa 0x4fc / 4) */
  runsBattedIn: 319,
} as const

/** 0xba0bc 색 — 0x1400748(r, g, b) 차례 */
export const CARD_COLORS = {
  border: '#000000',
  /** (0x33, 0x5f, 0xcd) */
  fill: '#335FCD',
  /** 소수점 (0xff, 0xff, 0xff) — 0x6a9f0 */
  point: '#FFFFFF',
  name: '#FFFFFF',
} as const

/** 숫자 기준 그림 — 주황 20 (0x44d6c 등 `movs #0x14`) · 타순 30 (0x45600 `movs #0x1e`) */
export const NUMBER_BASE = { stat: 20, order: 30 } as const

/** `0x6c7c0` 의 값 × 0x8c >> 16 */
const slideStepOf = (angle: number) => (sineSixteen(angle) * SLIDE_DISTANCE) >> 16

/**
 * 틱(상태 0xe 의 [장면+0x2c]) → 밀림 o. 0xe 에 들어선 틱이 0 이다 — `0xbc9c8` 이 상태를 바꿀 때 +0x14 = 0,
 * 그대로면 +0x14++ 한 뒤 진입 → 키 → 갱신 → **그리기** 차례라 첫 그림이 틱 0 이다.
 */
export function slideOffsetAt(tick: number): number {
  const start = tick === 0 ? 0x5a : 0x6e
  const angle = Math.min(tick * 16, 0x6e)
  return slideStepOf(start) - slideStepOf(angle)
}

export interface CardOrigins {
  readonly pitcher: { readonly x: number; readonly y: number }
  readonly batter: { readonly x: number; readonly y: number }
}

/**
 * 두 판의 왼쪽 위.
 * @param batterHand `0xb63c0(지금 타자)` — 1 좌타 · 0 우타
 * @param side 장면 +0x17e1 — 적재 8(0x4887e)이 같은 0xb63c0(모드 타자)로 넣는다. 안 넘기면 `batterHand`
 */
export function cardOriginsAt(tick: number, batterHand: number, side: number = batterHand): CardOrigins {
  const offset = slideOffsetAt(tick)
  const far = MATCHUP_SCREEN.width + offset - SLIDE_DISTANCE
  const pitcherBase = batterHand !== 0 ? far : -offset
  const batterBase = batterHand !== 0 ? -offset : far
  return {
    pitcher: { x: pitcherBase + (side > 0 ? 5 : -3), y: PITCHER_CARD_TOP },
    batter: { x: batterBase + (side > 0 ? -3 : 3), y: BATTER_CARD_TOP },
  }
}

export interface Placed {
  readonly x: number
  readonly y: number
}

/** 0xb9d74 의 세로 가운데 — d = 칸 − 그림 → `(d >> 1) + (d − trunc(d/2)·2)` (양수면 올림) */
const halfUp = (difference: number) => (difference >> 1) + (difference - Math.trunc(difference / 2) * 2)

/**
 * 박스에 프레임 하나 — `0xb9e8c(프레임, 배치, 박스, 정렬, 0, 0, ox, oy)` → `0xb9d74`.
 * 정렬 비트 0x2 가로 가운데 `+ (박스폭 − 프레임폭) >> 1` · 0x4 오른쪽 · 0x20 세로 가운데 · 0x40 아래. 0x11 은 왼쪽 위 그대로.
 * 돌려주는 자리는 프레임 원점이고 그림은 거기에 `[+0xe]`·`[+0x10]` 을 더한 곳에 놓인다.
 */
export function framePlacementOf(cardBox: CardBox, size: FrameSize, anchor: number, origin: Placed): Placed {
  let x = cardBox.x + origin.x
  let y = cardBox.y + origin.y
  if ((anchor & 0x2) !== 0) x += (cardBox.width - size.width) >> 1
  if ((anchor & 0x4) !== 0) x -= size.width - cardBox.width
  if ((anchor & 0x20) !== 0) y += halfUp(cardBox.height - size.height)
  if ((anchor & 0x40) !== 0) y -= size.height - cardBox.height
  return { x, y }
}

export interface NumberGlyph {
  readonly image: number
  readonly x: number
  readonly y: number
}

const digitsOf = (value: number) => [...String(Math.max(0, Math.trunc(value)))].map(Number)

/**
 * 박스 안 숫자 — `0xba6b8(배치, 박스, 자간, 값, 기준, 글꼴, 정렬, ox, oy)` → `0xba51c` (직접 떴다).
 * 폭 = Σ(글자 폭 + 자간) (마지막 글자 뒤 자간까지), 정렬 0x4 → x += 박스폭 − 폭 · 0x2 → x += (박스폭 − 폭) >> 1 ·
 * 0x20 → y += 세로 가운데(박스높이 − 가장 큰 높이) · 0x40 → 아래. 글자마다 가장 큰 높이에 아래를 맞춘다.
 */
export function boxNumberGlyphsOf(
  value: number, cardBox: CardBox, origin: Placed, base: number, spacing: number, align: number,
): NumberGlyph[] {
  const digits = digitsOf(value)
  const total = digits.reduce((sum, digit) => sum + numImageWidthOf(base + digit) + spacing, 0)
  let x = cardBox.x + origin.x
  let y = cardBox.y + origin.y
  if ((align & 0x4) !== 0) x += cardBox.width - total
  if ((align & 0x20) !== 0) y += halfUp(cardBox.height - NUM_IMAGE_HEIGHT)
  if ((align & 0x40) !== 0) y += cardBox.height - NUM_IMAGE_HEIGHT
  if ((align & 0x2) !== 0) x += (cardBox.width - total) >> 1
  return digits.map((digit) => {
    const placed = { image: base + digit, x, y }
    x += numImageWidthOf(base + digit) + spacing
    return placed
  })
}

/**
 * 자리를 채우는 숫자 — `0x585ac(스킨, 글꼴, 기준, 값, x, y, 간격, 자리, 정렬)` (직접 떴다, 0x585ac~0x5873a).
 * 폭은 **셋째 글자부터만** 간격을 더해 센다(0x58620). 정렬 0x1 이면 폭 0 · 0x2 면 폭/2 · 그 밖은 폭 그대로 x 에서 뺀다.
 * 0x40 → y −= 높이 · 0x20 → y −= trunc(높이/2) (높이 = 그림[기준] 높이). 자리가 모자라면 정렬 0x4 일 때 모자란 만큼
 * (그림[기준] 폭 + 간격)씩 더 왼쪽으로 가서 그림[기준]("0")을 먼저 찍는다. 글자마다 폭 + 간격씩 나아간다.
 */
export function paddedNumberGlyphsOf(
  value: number, x: number, y: number, base: number, gap: number, places: number, align: number,
): NumberGlyph[] {
  const digits = digitsOf(value)
  const measured = digits.reduce((sum, digit, index) => sum + numImageWidthOf(base + digit) + (index > 1 ? gap : 0), 0)
  const shift = (align & 0x1) !== 0 ? 0 : (align & 0x2) !== 0 ? measured >> 1 : measured
  let top = y
  if ((align & 0x40) !== 0) top = y - NUM_IMAGE_HEIGHT
  if ((align & 0x20) !== 0) top -= Math.trunc(NUM_IMAGE_HEIGHT / 2)
  let left = x - shift
  const glyphs: NumberGlyph[] = []
  const missing = places > 0 ? Math.max(0, places - digits.length) : 0
  if (missing > 0) {
    if ((align & 0x4) !== 0) left -= missing * (numImageWidthOf(base) + gap)
    for (let index = 0; index < missing; index += 1) {
      glyphs.push({ image: base, x: left, y: top })
      left += numImageWidthOf(base) + gap
    }
  }
  for (const digit of digits) {
    glyphs.push({ image: base + digit, x: left, y: top })
    left += numImageWidthOf(base + digit) + gap
  }
  return glyphs
}

export interface FillRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
  /** 0xba0bc 의 둥글기 (0 이면 0xb9f74 네모 칠 · 0x6a9f0 점) */
  readonly round: number
}

const fill = (x: number, y: number, width: number, height: number, color: string, round = 0): FillRect =>
  ({ x, y, width, height, color, round })

export interface PlainRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 기기 선 긋기(0x14006c8) 한 줄 — 두 끝을 다 칠한다. 끝이 거꾸로면 작은 쪽부터 */
const lineRect = (x1: number, y1: number, x2: number, y2: number): PlainRect => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  width: Math.abs(x2 - x1) + 1,
  height: Math.abs(y2 - y1) + 1,
})

/**
 * **둥근 칠 `0x6b7d4(gfx, x, y, w, h, 둥글기, 색)`** (직접 떴다, 0x6b7d4~0x6ba0a) — 둥글기는 7 로 자르고(6b7e4), 실제 모양은
 * 둘뿐이다. 칠 0x14006e8 = 기기 사각 칠(x, y, w, h) · 선 0x14006c8 = 기기 선(x1, y1, x2, y2). R = x + w · B = y + h.
 * ```
 * 둥글기 ≤ 3 (6b812):  칠(x+1, y+1, w−1, h−1) · 선(x+1, y, R−1, y) · 선(x+1, B, R−1, B) · 선(x, y+1, x, B−1) · 선(R, y+1, R, B−1)
 * 둥글기 4~7 (6b8c0):  칠(x+1, y+1, w−1, h−1) · 선(x+2, y, R−2, y) · 선(x+2, B, R−2, B) · 선(x, y+2, x, B−2) · 선(R, y+2, R, B−2)
 * ```
 * 그래서 둥근 칠은 **(w+1) × (h+1)** 칸을 덮고 모서리를 1칸(≤3) 또는 3칸(4~7, ㄱ자) 비운다 — 네모 칠 0xb9f74(→ 0x6a9f0 →
 * 같은 기기 사각 칠)은 w × h 다. (둥글기 > 7 갈래 6b952 는 자르기 때문에 안 탄다.) 폭이 음수인 칠은 아무것도 안 칠한다.
 */
export function roundFillRectsOf(rect: Pick<FillRect, 'x' | 'y' | 'width' | 'height' | 'round'>): PlainRect[] {
  const { x, y, width: w, height: h } = rect
  const right = x + w
  const bottom = y + h
  const inset = Math.min(7, rect.round) <= 3 ? 1 : 2
  const body: PlainRect[] = w - 1 > 0 && h - 1 > 0 ? [{ x: x + 1, y: y + 1, width: w - 1, height: h - 1 }] : []
  return [
    ...body,
    lineRect(x + inset, y, right - inset, y),
    lineRect(x + inset, bottom, right - inset, bottom),
    lineRect(x, y + inset, x, bottom - inset),
    lineRect(right, y + inset, right, bottom - inset),
  ]
}

/** 판 바탕 — 박스 0 둥글기 5 검정 · (+1, +1, −2, −2) 둥글기 5 #335FCD (0x44a96 · 0x44ae0 / 0x4516e · 0x451b2) */
export function cardBackgroundOf(origin: Placed): FillRect[] {
  const base = PITCHER_BOXES[0]
  return [
    fill(origin.x + base.x, origin.y + base.y, base.width, base.height, CARD_COLORS.border, 5),
    fill(origin.x + base.x + 1, origin.y + base.y + 1, base.width - 2, base.height - 2, CARD_COLORS.fill, 5),
  ]
}

/**
 * 방어율 — `v = 0xb6ce8(투수)` (자책 +0x22 × 2700 / 아웃 +0x20, 9999 상한 = 방어율 × 100).
 * 박스 11 ← trunc(v/100) · 박스 10 ← v % 10 (오른끝) · 그 왼쪽 1px 띄워 trunc(v/10) % 10 — 모두 자간 0 · 정렬 0x24.
 * 점 = 흰 1×2 를 (박스 11 오른끝 + 1, 박스 11 아래 − 3) 에 (0x6a9f0).
 */
export function earnedRunAverageGlyphsOf(value: number, origin: Placed): { glyphs: NumberGlyph[]; point: FillRect } {
  const hundredths = value % 10
  const tenths = Math.trunc(value / 10) % 10
  const intBox = PITCHER_BOXES[11]
  const decimalBox = PITCHER_BOXES[10]
  const tenthsOrigin = { x: origin.x - numImageWidthOf(NUMBER_BASE.stat + hundredths) - 1, y: origin.y }
  return {
    glyphs: [
      ...boxNumberGlyphsOf(Math.trunc(value / 100), intBox, origin, NUMBER_BASE.stat, 0, 0x24),
      ...boxNumberGlyphsOf(hundredths, decimalBox, origin, NUMBER_BASE.stat, 0, 0x24),
      ...boxNumberGlyphsOf(tenths, decimalBox, tenthsOrigin, NUMBER_BASE.stat, 0, 0x24),
    ],
    point: fill(
      origin.x + intBox.x + intBox.width + 1, origin.y + intBox.y + intBox.height - 3, 1, 2, CARD_COLORS.point,
    ),
  }
}

/**
 * 타율 — `v = 0xb8e3c(타자)` (안타 +0x22 × 1000 / 타수 +0x20, 1000 상한).
 * v ≤ 999 (0x453a2 `cmp #0x3e7`): `0x585ac(…, 기준 20, v, x = 박스11 오른끝, y = 박스11 위 + trunc(높이/2) + 1, 간격 1, 자리 3, 정렬 0x24)`.
 * v = 1000: 0xba6b8(박스 11, 자간 1, 정렬 0x24) 네 번 — 1 을 ox − 0x17 · 0 을 ox · ox − 7 · ox − 0xe 에 (0x4544c~0x454cc).
 * 점 = 흰 1×2 를 (박스 11 왼끝 − 2, 아래 − 3) 에.
 */
export function battingAverageGlyphsOf(value: number, origin: Placed): { glyphs: NumberGlyph[]; point: FillRect } {
  const avgBox = BATTER_BOXES[11]
  const point = fill(origin.x + avgBox.x - 2, origin.y + avgBox.y + avgBox.height - 3, 1, 2, CARD_COLORS.point)
  if (value <= 999) {
    const x = origin.x + avgBox.x + avgBox.width
    const y = origin.y + avgBox.y + Math.trunc(avgBox.height / 2) + 1
    return { glyphs: paddedNumberGlyphsOf(value, x, y, NUMBER_BASE.stat, 1, 3, 0x24), point }
  }
  const at = (dx: number) => ({ x: origin.x + dx, y: origin.y })
  return {
    glyphs: [
      ...boxNumberGlyphsOf(1, avgBox, at(-0x17), NUMBER_BASE.stat, 1, 0x24),
      ...boxNumberGlyphsOf(0, avgBox, at(0), NUMBER_BASE.stat, 1, 0x24),
      ...boxNumberGlyphsOf(0, avgBox, at(-7), NUMBER_BASE.stat, 1, 0x24),
      ...boxNumberGlyphsOf(0, avgBox, at(-0xe), NUMBER_BASE.stat, 1, 0x24),
    ],
    point,
  }
}

/**
 * 체력 막대의 셈 값 (0x44ea0~0x44f04).
 * - `lengthValue` = `0x66e44(0xb8680(팀), 투수, f)` — 실효 체력 0xb6414(투수, 3, 1) 를 컨디션([+2], 없으면 100)으로
 *   >90 +1/20 · 51~70 −1/10 · 31~50 −1/5 · 11~30 −30/100 · ≤10 −1/2 고친 뒤 + (f ? 200 : 0) + 250. 투수가 없으면 0.
 * - `maxValue` = f ? 0x5a9(1449) : 0x4e1(1249) — f = `팀[+0x26] − 팀[+0x33] == 1` (팀 = [장면+0x224]).
 * - `percent` = `0xaebb0(팀)` (남은 체력 %, 홈런더비는 늘 100 — P1).
 */
export interface StaminaGauge {
  readonly lengthValue: number
  readonly maxValue: number
  readonly percent: number
}

/**
 * 체력 막대 — 박스 9 (0x44f02~0x450a6, 직접 떴다).
 * ```
 * 길이 L = lengthValue × 박스폭 / maxValue
 * (x, y − 1, L, 14)        둥글기 1 #081C5A
 * (x + 1, y, L − 2, 12)    둥글기 1 #29349C
 * (x + 2, y + 1, L − 4, 6) #184DCE
 * 붉은 막대 R = ((percent × lengthValue / 100) × (박스폭 × 10 − 10) / maxValue) 를 s16 으로 / 10 − 2
 * (x + 2, y + 1, R, 1) #F32C00 · (…, y + 2, R, 5) #FF4D00 · (…, y + 7, R, 5) #F32C00 · (…, y + 12, R, 1) #CD1100
 * ```
 */
export function staminaGaugeRectsOf(gauge: StaminaGauge, origin: Placed): FillRect[] {
  const gaugeBox = PITCHER_BOXES[9]
  const x = origin.x + gaugeBox.x
  const y = origin.y + gaugeBox.y
  const length = Math.trunc((gauge.lengthValue * gaugeBox.width) / gauge.maxValue)
  const scaled = Math.trunc((gauge.percent * gauge.lengthValue) / 100)
  const raw = Math.trunc((scaled * (gaugeBox.width * 10 - 10)) / gauge.maxValue)
  // 0x44ffa `lsls #0x10 · asrs #0x10` — s16 로 자른 뒤 나눈다
  const red = Math.trunc(((raw << 16) >> 16) / 10) - 2
  return [
    fill(x, y - 1, length, 14, '#081C5A', 1),
    fill(x + 1, y, length - 2, 12, '#29349C', 1),
    fill(x + 2, y + 1, length - 4, 6, '#184DCE'),
    fill(x + 2, y + 1, red, 1, '#F32C00'),
    fill(x + 2, y + 2, red, 5, '#FF4D00'),
    fill(x + 2, y + 7, red, 5, '#F32C00'),
    fill(x + 2, y + 12, red, 1, '#CD1100'),
  ]
}

/**
 * 투수 보직 → (game_ui 칸, img_text 글자) — `0x545e8(스킨, 0xb6704(투수), &칸, &글자)`.
 * 0 선발 (4 빨강, 49) · 1 중계 (7 파랑, 170) · 2 구원 (5 초록, 182). 그 밖이면 둘 다 안 바꾼다 —
 * 칸은 0x44b9c 가 넣어 둔 0(game_ui 프레임 0), 글자는 박스 1 에 쓴 PLAYER/COM 번호가 남는다 (원본 그대로).
 */
export function pitcherRoleBadgeOf(role: number, playerLabel: number): { chip: number; label: number } {
  if (role === 0) return { chip: 4, label: 0x31 }
  if (role === 1) return { chip: 7, label: 0xaa }
  if (role === 2) return { chip: 5, label: 0xb6 }
  return { chip: 0, label: playerLabel }
}

/**
 * 타자 수비 → (game_ui 칸, img_text 글자) — `0x54590(스킨, +0x1c & 0xf, &칸, &글자)` (점프표 0xd1988).
 * 0 → 둘 다 −1(안 그린다) · 1 지명(7, 183) · 2 포수(5, 176) · 3 1루(5, 173) · 4 2루(5, 174) · 5 3루(5, 175) ·
 * 6 유격(5, 184) · 7 우익(4, 179) · 8 좌익(4, 177) · 9 중견(4, 178). 9 보다 크면 안 바꾼다(앞 판의 칸 · 이 판 박스 1 글자).
 */
const POSITION_BADGES: readonly { chip: number; label: number }[] = [
  { chip: -1, label: -1 },
  { chip: 7, label: 0xb7 }, { chip: 5, label: 0xb0 }, { chip: 5, label: 0xad }, { chip: 5, label: 0xae },
  { chip: 5, label: 0xaf }, { chip: 5, label: 0xb8 }, { chip: 4, label: 0xb3 }, { chip: 4, label: 0xb1 },
  { chip: 4, label: 0xb2 },
]

export function batterPositionBadgeOf(
  position: number, leftoverChip: number, playerLabel: number,
): { chip: number; label: number } {
  return POSITION_BADGES[position] ?? { chip: leftoverChip, label: playerLabel }
}

/**
 * 오늘 타석 기록 칸 — 기록 코드(0x53100 이 링 버퍼에서 꺼낸다) → (game_ui 칸 0xd00a0, img_text 글자 0xd0078).
 * 0 아웃 · 1 안타 · 2 2루타 · 3 3루타 · 4 홈런 · 5·6 아웃 · 7 삼진 · 8·9 사구.
 */
export const RESULT_CHIP_FRAMES: readonly number[] = [70, 69, 69, 69, 69, 70, 70, 70, 71, 71]
export const RESULT_CHIP_LABELS: readonly number[] = [361, 58, 59, 60, 61, 361, 361, 181, 362, 362]

/** 칸 폭 — 0xba815(game_ui, 0x45, 종류 1) 의 폭 32 (0x45668) */
const RESULT_CHIP_WIDTH = 32

export interface ResultChip {
  readonly frame: number
  readonly label: number
  /** 칸 그림 왼쪽 위 (0xba758) */
  readonly x: number
  readonly y: number
  /** 글자 원점 — 0x5650c 가 칸 크기(0xba815) 안 가운데(정렬 0x22)에 둔다 */
  readonly labelX: number
  readonly labelY: number
}

/**
 * 판 아래 오늘 타석 기록 (0x455f4~0x4577e). 개수 n = 칸+0xc, 시작 = n > 4 ? n − 4 : 0 → **마지막 넷**.
 * k 번째 칸 = (판x + (32 + 1)·k + 1, 판y + 62 + 1). 글자는 같은 자리 32×15 안 가운데.
 */
export function recentResultChipsOf(codes: readonly number[], origin: Placed): ResultChip[] {
  const start = codes.length > 4 ? codes.length - 4 : 0
  return codes.slice(start).map((code, index) => {
    const chipFrame = RESULT_CHIP_FRAMES[code] ?? RESULT_CHIP_FRAMES[0]
    const label = RESULT_CHIP_LABELS[code] ?? RESULT_CHIP_LABELS[0]
    const x = origin.x + (RESULT_CHIP_WIDTH + 1) * index + 1
    const y = origin.y + BATTER_BOXES[0].height + 1
    const chip = GAME_UI_FRAMES[chipFrame]
    const at = framePlacementOf(box(x, y, chip.width, chip.height), IMG_TEXT_FRAMES[label], 0x22, { x: 0, y: 0 })
    return { frame: chipFrame, label, x, y, labelX: at.x, labelY: at.y }
  })
}
