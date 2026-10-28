/**
 * **장비 창 0x83378** — 상점(상태 111)·장비착용(121)의 창 종류 3.
 *
 * 창 그리기 0x8453c 는 `[창+0x1a4] == 3` 이면 0x83378, 아니면 0x81dc0 으로 간다(0x84546 `cmp r3,#3`, 직접 떴다).
 * 그래서 장비는 서브·GP 의 10칸 격자(0x81dc0, mode_ui 프레임 33·34)를 **쓰지 않는다** — 앞서 웹이 44칸 격자에 레벨
 * 숫자를 적어 둔 것은 웹이 만든 꼴이었다. 0x83378 은 시즌 구장 아이템(종류 4, 0xb158 이 직접 부른다)과 같은 함수다.
 *
 * 배치는 mode_ui **프레임 30(타자, `0x7b970` 참) · 31(투수)** 박스 일곱 개(0x833a6~0x833ba, 시즌·종류 4 면 프레임 32):
 * ```
 * 박스 0 (134,164,19,13)  부위 탭 칸 — 네 칸이 x 로 (폭 + 2) 씩. 프레임 그림에 부위 아이콘 넷이 들어 있다
 * 박스 1 (26,180,37,15)   왼쪽 이름표 세 줄 — img_text 표 0xd495c [302 소지금 · 303 가격 · 333 효과]
 * 박스 2 (64,180,63,15)   왼쪽 값 세 줄 — 소지금 · 가격 · 효과(능력치 이름 + "+" + 보너스)
 * 박스 3 (134,180,70,15)  오른쪽 목록 다섯 줄 — 장비 이름
 * 박스 4 (27,233,100,37)  설명 (프레임 32 는 (27,217,100,53))
 * 박스 5 (207,185,7,73)   스크롤 막대
 * 박스 6 (18,176,203,90)  판 0x7c110(창, 박스 6, 1)
 * ```
 * 줄 간격은 박스 높이 + 2 = 17 이다(0x836be · 0x8434a).
 *
 * 그리는 차례 (0x83378, 직접 떴다):
 * ```
 * 833f6  판 0x7c110(창, 박스 6, 1)
 * 83426  박스 0 칸마다(4) 세로선 (x, y)~(x, y + h − 2) #4A7BDE · (x + 1, …) #29318C, x += w + 2
 * 8349a  박스 4 설명 판 (`descriptionPanelRectsOf`)
 * 8360a  프레임 그림 (vt+0x10, (0, 0)) — 부위 아이콘 · 왼쪽 막대 셋 · 오른쪽 막대 다섯 · ▲▼
 * 83630  이름표 셋 — img_text 팔레트 0, 박스 1 줄 k 에 정렬 0x24 · ox −2 (시즌 · 종류 ≠ 3 이면 셋째 줄은 건너뜀)
 * 83714  소지금 0x63331(박스 2 줄 0, 선수 +2 × 100, num, 정렬 0x24, ox −2)
 * 83740  부위 탭 커서 mode_ui 51 — [창+0x1a8](목록 초점) 이거나 틱 % 10 ≠ 0 이면 (박스0.x + 2 + (w + 2)·부위, 박스0.y) 칸 가운데
 * 837ea  목록 줄 (위 줄부터 다섯 줄, `줄 ≥ 개수` 면 건너뜀):
 *          글색 하늘 (135,248,255) · 바탕 없음
 *          상점(상태 111)이고 가진 것  → 바탕 mode_ui 44(흰 막대) · 글색 베이지 (206,199,189)
 *          지금 낀 것(니블 − 1 == 레벨)  → 바탕 mode_ui 43(주황 막대) · 글색 남색 (24,44,107)   ; 가진 것보다 나중이라 이긴다
 *          이름 — 레벨 > 6 이고 해금표(0x9f69d)가 0 이면 0xd4c18 "????", 아니면 0x832e8 이름 · 0xba411 정렬 0x22
 *          목록 초점이고 고른 줄이면:
 *            83c28  틱 % 10 ≠ 0 이면 노랑 (255,255,0) 사각 테두리 0xb9ed5(줄 박스)
 *            83d38  가격 0x63331(박스 2 줄 1, 표 0xd4510 × 1000 만원 — 타자면 +44칸)
 *            83de8  효과 줄 (박스 2 줄 2) — `effectRowLayoutOf`
 *            84256  설명 (박스 4, 정렬 0x11, (5, 5)) — `equipmentRows` 의 description
 * 84380  스크롤 막대 (`scrollBarRectsOf`, 한 화면 5줄)
 * ```
 */
import type { ShopBox } from '@/pages/shop/lib/shopLayout'
import { isBugFixed } from '@/shared/config/bugfixes'

export type EquipmentEdition = '타자' | '투수'

/** mode_ui 프레임 — `0x7b970`(타자편) 이면 30, 아니면 31 (0x8339e~0x833aa) */
export const EQUIPMENT_FRAME: Readonly<Record<EquipmentEdition, number>> = { 타자: 30, 투수: 31 }

const box = (x: number, y: number, width: number, height: number): ShopBox => ({ x, y, width, height })

/** 프레임 30 · 31 박스 (`public/sprites/mode_ui/frames/boxes.json` 의 "030" · "031" — 두 프레임이 같다) */
export const EQUIPMENT_BOXES = {
  tab: box(134, 164, 19, 13),
  label: box(26, 180, 37, 15),
  value: box(64, 180, 63, 15),
  row: box(134, 180, 70, 15),
  description: box(27, 233, 100, 37),
  scrollBar: box(207, 185, 7, 73),
  board: box(18, 176, 203, 90),
} as const

/** 탭 칸 수 · 한 화면 줄 수 ([목록+0x38] = 5, 0x815ea) · 줄 간격 (h + 2) */
export const EQUIPMENT_PART_COUNT = 4
export const EQUIPMENT_VISIBLE_ROWS = 5
export const EQUIPMENT_ROW_STEP = EQUIPMENT_BOXES.row.height + 2
export const EQUIPMENT_TAB_STEP = EQUIPMENT_BOXES.tab.width + 2

/** 이름표 img_text — 표 0xd495c [302 소지금 · 303 가격 · 333 효과] */
export const EQUIPMENT_LABEL_FRAMES: readonly number[] = [302, 303, 333]
/** 효과 줄의 능력치 이름 img_text — `[창+0x24c]`(타자 깃발) 이면 336 + 부위(히트·파워·수비·주루), 아니면 340 + 부위(제구·구속·변화·체력) */
export const ABILITY_LABEL_BASE: Readonly<Record<EquipmentEdition, number>> = { 타자: 336, 투수: 340 }
/** 효과 줄 능력치 이름은 img_text **팔레트 1**(노랑 #FFE352 · #FFB229)로 찍는다 (0x83f70 `0x913e5(애니, 1)`) */
export const ABILITY_LABEL_PALETTE = 1
/** num "+" 그림 (`[num+0x1a4]` = 105) */
export const PLUS_FRAME = 105
/** 잠긴 히든 칸 이름 0xd4c18 */
export const LOCKED_NAME = '????'

export const EQUIPMENT_MODE_UI_FRAME = {
  /** 21×14 노란 테 — 고른 부위 탭 (0xcc/4) */
  tabCursor: 51,
  /** 70×15 주황 막대 — 지금 낀 줄 (0x2b) */
  equippedBar: 43,
  /** 70×15 흰 막대 — 상점에서 가진 줄 (0x2c) */
  ownedBar: 44,
} as const

export const EQUIPMENT_COLORS = {
  tabLine: '#4A7BDE',
  tabLineDark: '#29318C',
  /** 설명 판 — 위·왼 선 #18244A · 채우기 #1D44A8 · 오른·아래 빛 #4A7DDE */
  panelEdge: '#18244A',
  panelFill: '#1D44A8',
  panelLight: '#4A7DDE',
  /** 목록 글색 (0x83802 · 0x83904 · 0x83984) */
  rowText: '#87F8FF',
  ownedText: '#CEC7BD',
  equippedText: '#182C6B',
  /** 설명 글 — 가격을 그리기 전 0x9c735(…, 흰색) (0x83d5c) */
  descriptionText: '#FFFFFF',
  cursor: '#FFFF00',
  /** 스크롤 막대 — 바탕 #102152 · 손잡이 흰 테 + #1D44A8 */
  scrollTrack: '#102152',
  scrollThumbEdge: '#FFFFFF',
  scrollThumb: '#1D44A8',
} as const

/** 설명 글 자리 — 0xba411(박스 4, 글, 정렬 0x11, ox 5, oy 5) */
export const DESCRIPTION_INSET = 5
/** 왼쪽 값·이름표 ox −2 (정렬 0x24) */
export const VALUE_RIGHT_INSET = 2

/** 한 칸짜리 색 사각형 — 선·점도 이걸로 적는다 (가로·세로선은 양 끝을 포함한다) */
export interface PixelRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

const rect = (x: number, y: number, width: number, height: number, color: string): PixelRect => ({ x, y, width, height, color })
/** 0x6a905 가로선 (x1, y)~(x2, y) — 양 끝 포함 */
const hLine = (x1: number, x2: number, y: number, color: string) => rect(Math.min(x1, x2), y, Math.abs(x2 - x1) + 1, 1, color)
/** 0x6a905 세로선 (x, y1)~(x, y2) */
const vLine = (x: number, y1: number, y2: number, color: string) => rect(x, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1, color)
/** 0x6a8a9 점 */
const dot = (x: number, y: number, color: string) => rect(x, y, 1, 1, color)

/** 판 0x7c110 색 */
export const BOARD_COLORS = {
  fill: '#335FCD',
  light: '#4F7EF3',
  dark: '#244CAE',
  /** 셋째 인자가 1 이면 솟은 칸 바탕이 #1D44A8, 0 이면 판과 같은 #335FCD */
  raised: '#1D44A8',
} as const

/**
 * 판 0x7c110(창, 박스, 깃발) — 직접 떴다(0x7c110~0x7c434). 기본정보 카드의 정보 칸 0x7c450 도 같은 판을 쓴다.
 * X·Y·W·H = 박스, s = 깃발 ? 1 : 10, c = X + trunc(W/2) + s:
 * ```
 * 7c13e  채우기 (X, Y, W, H) #335FCD
 * 7c188  (X, Y−1)~(c, Y−1) #4F7EF3 · (X−1, Y−2)~(c, Y−2) #244CAE          ; 왼쪽 윗변
 * 7c1ce  i = 1..12: 점 (c+i, Y−i) #4F7EF3 · 점 (c+i, Y−i−1) #244CAE ·
 *               (c+i+1, Y−i)~(X+W−1, Y−i) 깃발 ? #1D44A8 : #335FCD       ; 오른쪽 위로 솟은 칸(빗변 45°)
 * 7c27e  (c+13, Y−12)~(X+W−1, Y−12) #4F7EF3 · (c+13, Y−13)~(X+W, Y−13) #244CAE
 * 7c2c4  b = X + trunc(W/2) − s 로 두고 **x 자리마다 X 를 한 번 더 더한다**(7c2f0 `adds r4, r7, r6` — 원본 그대로):
 *        (X+b+2, Y+H+1)~(X+W, Y+H+1) · (X+b+2, Y+H)~(X+W, Y+H) #244CAE   ; 오른쪽 아랫변
 *        i = 1..12 (b 는 줄마다 −1): (X, Y+H−1+i)~(X+b, …) #335FCD · (X+b, …)~(X+b+2, …) #244CAE  ; 왼쪽 아래로 내려온 칸
 * 7c398  b' = b − 12: (X−1, Y+H+13)~(X+b'+1, …) · (X−1, Y+H+12)~(X+b'+2, …) #244CAE
 * 7c3fc  채우기 (X−2, Y−1, 2, H+14) · (X+W, Y−12, 2, H+13) #244CAE         ; 왼·오른 테
 * ```
 * ⚠️ X 를 두 번 더하는 것은 원본 버그(B-89)다 — 박스 6(X = 18)이면 아래 칸 빗변이 18px 오른쪽으로 밀린다. 고친 길은 X 를 한 번만 더한다.
 */
export function boardRectsOf(board: ShopBox, isRaisedDark: boolean): readonly PixelRect[] {
  const { x, y, width, height } = board
  const step = isRaisedDark ? 1 : 10
  const half = Math.trunc(width / 2)
  const top = x + half + step
  const rects: PixelRect[] = [
    rect(x, y, width, height, BOARD_COLORS.fill),
    hLine(x, top, y - 1, BOARD_COLORS.light),
    hLine(x - 1, top, y - 2, BOARD_COLORS.dark),
  ]
  for (let i = 1; i <= 12; i += 1) {
    rects.push(dot(top + i, y - i, BOARD_COLORS.light))
    rects.push(dot(top + i, y - i - 1, BOARD_COLORS.dark))
    rects.push(hLine(top + i + 1, x + width - 1, y - i, isRaisedDark ? BOARD_COLORS.raised : BOARD_COLORS.fill))
  }
  rects.push(hLine(top + 13, x + width - 1, y - 12, BOARD_COLORS.light))
  rects.push(hLine(top + 13, x + width, y - 13, BOARD_COLORS.dark))

  // B-89 고친 길 — X 를 한 번만 더해 아래 칸 빗변이 위 칸처럼 X + trunc(W/2) − s 에서 선다. 굴림 없음
  let bottom = isBugFixed('B-89') ? half - step : x + half - step
  rects.push(hLine(x + bottom + 2, x + width, y + height + 1, BOARD_COLORS.dark))
  rects.push(hLine(x + bottom + 2, x + width, y + height, BOARD_COLORS.dark))
  for (let i = 1; i <= 12; i += 1) {
    const rowY = y + height - 1 + i
    rects.push(hLine(x, x + bottom, rowY, BOARD_COLORS.fill))
    rects.push(hLine(x + bottom, x + bottom + 2, rowY, BOARD_COLORS.dark))
    bottom -= 1
  }
  rects.push(hLine(x - 1, x + bottom + 1, y + height + 13, BOARD_COLORS.dark))
  rects.push(hLine(x - 1, x + bottom + 2, y + height + 12, BOARD_COLORS.dark))
  rects.push(rect(x - 2, y - 1, 2, height + 14, BOARD_COLORS.dark))
  rects.push(rect(x + width, y - 12, 2, height + 13, BOARD_COLORS.dark))
  return rects
}

/** 박스 0 의 탭 칸 세로선 — 칸마다 (x, y)~(x, y+h−2) #4A7BDE · x+1 #29318C (0x83426~0x83486) */
export function tabSeparatorRectsOf(tab: ShopBox): readonly PixelRect[] {
  return Array.from({ length: EQUIPMENT_PART_COUNT }, (_unused, index) => {
    const x = tab.x + EQUIPMENT_TAB_STEP * index
    const bottom = tab.y + tab.height - 2
    return [vLine(x, tab.y, bottom, EQUIPMENT_COLORS.tabLine), vLine(x + 1, tab.y, bottom, EQUIPMENT_COLORS.tabLineDark)]
  }).flat()
}

/**
 * 설명 판 (박스 4, 0x83488~0x835f6):
 * ```
 * (X, Y)~(X+W−1, Y) #18244A · 채우기 (X, Y+1, W, H−6) #1D44A8 · (X, Y)~(X, Y+H) #18244A · (X+W−1, Y+1)~(X+W−1, Y+H−6) #4A7DDE
 * k = 0..4: (X+1, Y+H−5+k)~(X+W−1−k, …) #1D44A8 · 점 (X+W−1−k, Y+H−5+k) #4A7DDE      ; 오른쪽 아래 모서리를 깎는다
 * (X+1, Y+H)~(X+W−6, Y+H) #4A7DDE
 * ```
 */
export function descriptionPanelRectsOf(panel: ShopBox): readonly PixelRect[] {
  const { x, y, width, height } = panel
  const rects: PixelRect[] = [
    hLine(x, x + width - 1, y, EQUIPMENT_COLORS.panelEdge),
    rect(x, y + 1, width, height - 6, EQUIPMENT_COLORS.panelFill),
    vLine(x, y, y + height, EQUIPMENT_COLORS.panelEdge),
    vLine(x + width - 1, y + 1, y + height - 6, EQUIPMENT_COLORS.panelLight),
  ]
  for (let k = 0; k <= 4; k += 1) {
    const rowY = y + height - 5 + k
    const right = x + width - 1 - k
    rects.push(hLine(x + 1, right, rowY, EQUIPMENT_COLORS.panelFill))
    rects.push(dot(right, rowY, EQUIPMENT_COLORS.panelLight))
  }
  rects.push(hLine(x + 1, x + width - 6, y + height, EQUIPMENT_COLORS.panelLight))
  return rects
}

/** 0xca7b5 — 0 쪽으로 자르는 나눗셈 */
const divide = (value: number, by: number) => Math.trunc(value / by)

/**
 * 스크롤 막대 (0x84380~0x84526 · 칭호 목록 0x19c06~0x19d8c 가 같은 꼴):
 * ```
 * 바탕 (X, Y, W, H) #102152
 * 개수 ≤ 한 화면 → (X+1, Y, W−2, H) 흰색 · (X+2, Y+1, W−4, H−2) #1D44A8
 * 그 밖          → L = (H·한 화면 + 개수 − 1) / 개수 · d = 윗줄·H / 개수
 *                  (X+1, Y+d, W−2, L−1) 흰색 · (X+2, Y+d+1, W−4, L−3) #1D44A8
 * ```
 */
export function scrollBarRectsOf(bar: ShopBox, count: number, top: number, visible: number): readonly PixelRect[] {
  const { x, y, width, height } = bar
  const track = rect(x, y, width, height, EQUIPMENT_COLORS.scrollTrack)
  if (count <= visible) {
    return [
      track,
      rect(x + 1, y, width - 2, height, EQUIPMENT_COLORS.scrollThumbEdge),
      rect(x + 2, y + 1, width - 4, height - 2, EQUIPMENT_COLORS.scrollThumb),
    ]
  }
  const length = divide(height * visible + count - 1, count)
  const offset = divide(top * height, count)
  return [
    track,
    rect(x + 1, y + offset, width - 2, length - 1, EQUIPMENT_COLORS.scrollThumbEdge),
    rect(x + 2, y + offset + 1, width - 4, length - 3, EQUIPMENT_COLORS.scrollThumb),
  ]
}

/** 박스를 줄 k 로 내린다 (y += k · (h + 2)) */
export const rowBoxOf = (base: ShopBox, row: number): ShopBox => ({ ...base, y: base.y + row * (base.height + 2) })

/** 부위 탭 커서 칸 — (박스0.x + 2 + (w + 2)·부위, 박스0.y, w, h) (0x8376a~0x83782) */
export const tabCursorBoxOf = (part: number): ShopBox => ({
  ...EQUIPMENT_BOXES.tab,
  x: EQUIPMENT_BOXES.tab.x + 2 + EQUIPMENT_TAB_STEP * part,
})

/**
 * 프레임 정렬 (0xb9e05 · 0xb9d35) — 가로 0x1 왼쪽 · 0x2 가운데(`(박스폭 − 폭) >> 1`) · 0x4 오른쪽,
 * 세로 0x10 위 · 0x20 가운데 · 0x40 아래. 0xb9e05 의 세로 가운데는 e = h − 높이 → `trunc(e/2) + e % 2`(올림),
 * 0xb9d35 는 내림(`trunc(e/2)`) 이다 (managementLayout · nationalCupLayout 과 같은 근거).
 */
export function alignedPositionOf(
  target: ShopBox,
  width: number,
  height: number,
  align: number,
  ox = 0,
  oy = 0,
  isRoundingDown = false,
): { readonly x: number; readonly y: number } {
  const dx = target.width - width
  const dy = target.height - height
  const x = (align & 0x4) !== 0 ? target.x + dx : (align & 0x2) !== 0 ? target.x + (dx >> 1) : target.x
  const middle = isRoundingDown ? Math.trunc(dy / 2) : Math.trunc(dy / 2) + (dy % 2)
  const y = (align & 0x40) !== 0 ? target.y + dy : (align & 0x20) !== 0 ? target.y + middle : target.y
  return { x: x + ox, y: y + oy }
}

/** 0x6c805(v, 10) — v 를 10 으로 몇 번 나눠야 0 이 되는지 − 1 (곧 자릿수 − 1) */
export function digitShiftOf(value: number): number {
  let count = 0
  let rest = Math.trunc(value / 10)
  while (rest !== 0) {
    count += 1
    rest = Math.trunc(rest / 10)
  }
  return count
}

/**
 * 효과 줄 (박스 2 줄 2, 0x83f48~0x8412a) — 보너스 b, d = `digitShiftOf(b)`:
 * ```
 * 능력치 이름  img_text (336|340 + 부위) 팔레트 1 · 0xb9e05 정렬 0x24 · ox −(7d + 19)
 * "+"          num 105 · 0xb9d35 정렬 0x24 · ox −(7d + 10) · oy 1
 * 숫자         0xba719(자간 1, b, 기준 20, num, 정렬 0x24, ox −2)
 * ```
 */
export function effectOffsetsOf(bonus: number): { readonly labelOx: number; readonly plusOx: number } {
  const shift = digitShiftOf(bonus)
  return { labelOx: -(shift * 7 + 19), plusOx: -(shift * 7 + 10) }
}
