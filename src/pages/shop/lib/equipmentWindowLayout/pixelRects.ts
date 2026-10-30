/** 장비 창의 한 칸짜리 색 사각형들 — 판 0x7c110 · 탭 세로선 · 설명 판 · 스크롤 막대 */
import type { ShopBox } from '@/pages/shop/lib/shopLayout'
import { isBugFixed } from '@/shared/config/bugfixes'
import { EQUIPMENT_COLORS, EQUIPMENT_PART_COUNT, EQUIPMENT_TAB_STEP } from '@/pages/shop/lib/equipmentWindowLayout/equipmentConstants'

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
  return [
    ...boardTopRectsOf(board, x + half + step, isRaisedDark),
    // B-89 고친 길 — X 를 한 번만 더해 아래 칸 빗변이 위 칸처럼 X + trunc(W/2) − s 에서 선다. 굴림 없음
    ...boardBottomRectsOf(board, isBugFixed('B-89') ? half - step : x + half - step),
    rect(x - 2, y - 1, 2, height + 14, BOARD_COLORS.dark),
    rect(x + width, y - 12, 2, height + 13, BOARD_COLORS.dark),
  ]
}

/** 7c13e~7c27e — 채우기 · 왼쪽 윗변 · 오른쪽 위로 솟은 칸 (top = c) */
function boardTopRectsOf({ x, y, width, height }: ShopBox, top: number, isRaisedDark: boolean): PixelRect[] {
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
  return rects
}

/** 7c2c4~7c398 — 오른쪽 아랫변 · 왼쪽 아래로 내려온 칸 (빗변 b 는 줄마다 −1) */
function boardBottomRectsOf({ x, y, width, height }: ShopBox, firstBottom: number): PixelRect[] {
  let bottom = firstBottom
  const rects: PixelRect[] = [
    hLine(x + bottom + 2, x + width, y + height + 1, BOARD_COLORS.dark),
    hLine(x + bottom + 2, x + width, y + height, BOARD_COLORS.dark),
  ]
  for (let i = 1; i <= 12; i += 1) {
    const rowY = y + height - 1 + i
    rects.push(hLine(x, x + bottom, rowY, BOARD_COLORS.fill))
    rects.push(hLine(x + bottom, x + bottom + 2, rowY, BOARD_COLORS.dark))
    bottom -= 1
  }
  rects.push(hLine(x - 1, x + bottom + 1, y + height + 13, BOARD_COLORS.dark))
  rects.push(hLine(x - 1, x + bottom + 2, y + height + 12, BOARD_COLORS.dark))
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
