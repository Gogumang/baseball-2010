/**
 * **공용 판 `0x55e60` 과 안쪽 칸 `0xbb28c` 의 칠 목록** — 둘 다 직접 떴다(0x55e60~0x561f0 · 0xbb28c~0xbb388).
 * 그림은 판 왼쪽 위를 (0, 0) 으로 한 칠 칸(`PanelPaint`) 목록이고, 차례대로 칠하면 원본과 같은 점이 나온다(뒤 칸이 앞 칸을 덮는다).
 *
 * 기본 칠하기(모두 직접 뜬 함수, R = x + w · B = y + h):
 * ```
 * 0x6a9f0 네모 칠 (x, y, w, h, 색)            — w × h
 * 0x6a904 선 (x1, y1, x2, y2, 색)            — 기기 선 [0x14006c8], 두 끝을 다 칠한다
 * 0x6a8a8 점 (x, y, 색)                       — 0x6a85c, 화면 밖이면 안 찍는다
 * 0x6b7d4 둥근 칠 (x, y, w, h, 둥글기 ≤ 3, 색) — 칠(x+1, y+1, w−1, h−1) + 선 (x+1, y)–(R−1, y) · (x+1, B)–(R−1, B) ·
 *                                               (x, y+1)–(x, B−1) · (R, y+1)–(R, B−1) → (w+1)×(h+1), 네 모서리 점은 빈다
 * 0x6aa64 둥근 테두리 (x, y, w, h, 둥글기 ≤ 3, 색) — 위 선 넷만 (0x6aa9c~0x6ab0e)
 * ```
 * 색 인자의 윗바이트는 알파다(0 · 0xff 면 불투명). 이 판을 부르는 자리는 모두 다섯째 인자(알파) 0 이라 불투명만 옮긴다.
 */

export interface PanelPaint {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

/** 0x55e60 의 색 (리터럴 0x56208 · 0x56210 · 0x5621c · 0x56220 · 0x56228 · 0x5622c) */
export const COMMON_PANEL_COLORS = {
  fill: '#335FCD',
  edge: '#080408',
  white: '#FFFFFF',
  light: '#E2E2E2',
  grey: '#C5C5C5',
  deep: '#1D44A8',
} as const

/** 0xbb28c 의 색 — 0x1400748(r, g, b) 로 만든다 (0xbb2cc · 0xbb2f0 · 0xbb340) */
export const INSET_BOX_COLORS = {
  fill: '#1D44A8', // RGB(0x1d, 0x44, 0xa8)
  lit: '#5A86FF', // RGB(0x5a, 0x86, 0xff) — 오른쪽 · 아래 변
  shade: '#08246B', // RGB(0x08, 0x24, 0x6b) — 위 · 왼쪽 변
} as const

const fill = (x: number, y: number, width: number, height: number, color: string): PanelPaint[] =>
  (width > 0 && height > 0 ? [{ x, y, width, height, color }] : [])

/** 기기 선 — 가로·세로면 한 칸, 그 밖(이 파일은 45° 만 쓴다)은 브레젠험 점들 */
function line(x1: number, y1: number, x2: number, y2: number, color: string): PanelPaint[] {
  if (x1 === x2 || y1 === y2) {
    return [{
      x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1) + 1, height: Math.abs(y2 - y1) + 1, color,
    }]
  }
  const points: PanelPaint[] = []
  const dx = Math.abs(x2 - x1)
  const dy = -Math.abs(y2 - y1)
  const sx = x1 < x2 ? 1 : -1
  const sy = y1 < y2 ? 1 : -1
  let error = dx + dy
  let x = x1
  let y = y1
  for (;;) {
    points.push({ x, y, width: 1, height: 1, color })
    if (x === x2 && y === y2) return points
    const doubled = 2 * error
    if (doubled >= dy) { error += dy; x += sx }
    if (doubled <= dx) { error += dx; y += sy }
  }
}

/** 둥근 테두리 0x6aa64 (둥글기 ≤ 3) */
function roundEdge(x: number, y: number, w: number, h: number, color: string): PanelPaint[] {
  const right = x + w
  const bottom = y + h
  return [
    ...line(x + 1, y, right - 1, y, color),
    ...line(x + 1, bottom, right - 1, bottom, color),
    ...line(x, y + 1, x, bottom - 1, color),
    ...line(right, y + 1, right, bottom - 1, color),
  ]
}

/** 둥근 칠 0x6b7d4 (둥글기 ≤ 3) — 칠 위에 같은 칸 테두리 선 넷 */
const roundFill = (x: number, y: number, w: number, h: number, color: string): PanelPaint[] =>
  [...fill(x + 1, y + 1, w - 1, h - 1, color), ...roundEdge(x, y, w, h, color)]

/**
 * 둥근 테두리 0x6aa64(x, y, w, h, 둥글기 ≤ 3, 색) 의 칠 목록 — 왼쪽 위 = (0, 0), (w + 1) × (h + 1) 을 덮는다.
 * 0xba015(상자, 둥글기, 색) 가 이것을 부른다(0xba05e).
 */
export const roundEdgePaintsOf = (w: number, h: number, color: string): PanelPaint[] => roundEdge(0, 0, w, h, color)

/** 둥근 칠 0x6b7d4(둥글기 ≤ 3) 의 칠 목록 — 0xba0bd(상자, 둥글기, 색) 가 이것을 부른다(0xba106). (w + 1) × (h + 1) */
export const roundFillPaintsOf = (w: number, h: number, color: string): PanelPaint[] => roundFill(0, 0, w, h, color)

export interface CommonPanelOptions {
  readonly width: number
  readonly height: number
  /** 일곱째 인자 [sp+0x84] — 띠 높이. 제목 탭이 아니고 > 0 이면 판 위에 띠를 긋는다 */
  readonly topBand?: number
  /** 여덟째 인자 [sp+0x88] — 아래 띠 높이 */
  readonly bottomBand?: number
  /** 아홉째 인자 [sp+0x8c] — ≠ 0 이면 위 두 띠 대신 왼쪽 위 제목 탭을 그린다 */
  readonly titleTab?: boolean
}

/**
 * **공용 판 `0x55e60(skin, x, y, w, h, 알파, 정렬, 위 띠, 아래 띠, 제목 탭, 어둡게)`** 의 칠 목록 (정렬로 옮긴 뒤 왼쪽 위 = (0, 0)).
 *
 * ```
 * 55f0e  둥근 칠 0x6b7d4(x, y, w−1, h−1, 1, #335FCD)               ; w × h, 네 모서리 점은 빈다
 * 55f28  둥근 테두리 0x6aa64(x, y, w−1, h−1, 1, #080408)
 * 55f44  점 0x6a8a8 #080408 넷 — (x+1, y+1) · (x+w−2, y+1) · (x+1, y+h−2) · (x+w−2, y+h−2)
 * 55f92  둥근 테두리 0x6aa64(x+1, y+1, w−3, h−3, 1, #FFFFFF)
 * 55fb6  제목 탭([sp+0x8c] ≠ 0, cx = x + w/2):
 *          선 #E2E2E2 (x+2, y+2)–(x+w−3, y+2) · (x+2, y+3)–(cx, y+3) · i = 0..13: (x+2, y+3+i)–(cx−i, y+3+i)
 *          선 #C5C5C5 (x+2, y+17)–(cx−14, y+17) · (cx−14, y+17)–(cx, y+3) · (cx+1, y+3)–(x+w−3, y+3)
 *          선 #1D44A8 (x+2, y+18)–(cx−14, y+18) · (cx−14, y+18)–(cx, y+4) · (cx+1, y+4)–(x+w−3, y+4)
 *          선 #FFFFFF i = 0..7: (x+3, y+3+i)–(cx−i−2, y+3+i)                ; 그리고 끝 (띠는 안 본다)
 * 560fe  아니면 위 띠 t = [sp+0x84] > 0:
 *          선 #C5C5C5 (x+2, y+2)–(x+w−3, y+2) · (x+2, y+t+2)–(x+w−3, y+t+2)
 *          칠 #FFFFFF (x+2, y+3, w−4, t/2) · 칠 #E2E2E2 (x+2, y+2+t/2, w−4, t/2)
 * 56172  아래 띠 b = [sp+0x88] > 0, yb = y + h − b − 3:
 *          선 #C5C5C5 (x+2, yb)–(x+w−3, yb) · (x+2, yb+b)–(x+w−3, yb+b)
 *          칠 #FFFFFF (x+2, yb+1, w−4, b/2) · 칠 #E2E2E2 (x+2, yb+b/2, w−4, b/2)
 * ```
 * 나눗셈은 모두 0 쪽으로 버린다(asr + 부호 보정). 어둡게([sp+0x90] ≠ 0)는 판 앞에 화면 전체를 [0x15605d0] 검정 단계 5 로
 * 덮는 것이라(0x55ea8~0x55ebe) 판 칠 목록에는 넣지 않고 `CommonPanel` 의 `dim` 이 판 뒤에 화면 전체 덮개로 깐다.
 */
export function commonPanelPaintsOf({
  width: w, height: h, topBand = 0, bottomBand = 0, titleTab = false,
}: CommonPanelOptions): PanelPaint[] {
  const c = COMMON_PANEL_COLORS
  const paints: PanelPaint[] = [
    ...roundFill(0, 0, w - 1, h - 1, c.fill),
    ...roundEdge(0, 0, w - 1, h - 1, c.edge),
    ...fill(1, 1, 1, 1, c.edge),
    ...fill(w - 2, 1, 1, 1, c.edge),
    ...fill(1, h - 2, 1, 1, c.edge),
    ...fill(w - 2, h - 2, 1, 1, c.edge),
    ...roundEdge(1, 1, w - 3, h - 3, c.white),
  ]
  if (titleTab) {
    const cx = Math.trunc(w / 2)
    paints.push(...line(2, 2, w - 3, 2, c.light), ...line(2, 3, cx, 3, c.light))
    for (let i = 0; i <= 13; i += 1) paints.push(...line(2, 3 + i, cx - i, 3 + i, c.light))
    paints.push(
      ...line(2, 17, cx - 14, 17, c.grey), ...line(cx - 14, 17, cx, 3, c.grey), ...line(cx + 1, 3, w - 3, 3, c.grey),
      ...line(2, 18, cx - 14, 18, c.deep), ...line(cx - 14, 18, cx, 4, c.deep), ...line(cx + 1, 4, w - 3, 4, c.deep),
    )
    for (let i = 0; i <= 7; i += 1) paints.push(...line(3, 3 + i, cx - i - 2, 3 + i, c.white))
    return paints
  }
  if (topBand > 0) {
    const half = Math.trunc(topBand / 2)
    paints.push(
      ...line(2, 2, w - 3, 2, c.grey), ...line(2, topBand + 2, w - 3, topBand + 2, c.grey),
      ...fill(2, 3, w - 4, half, c.white), ...fill(2, 2 + half, w - 4, half, c.light),
    )
  }
  if (bottomBand > 0) {
    const top = h - bottomBand - 3
    const half = Math.trunc(bottomBand / 2)
    paints.push(
      ...line(2, top, w - 3, top, c.grey), ...line(2, top + bottomBand, w - 3, top + bottomBand, c.grey),
      ...fill(2, top + 1, w - 4, half, c.white), ...fill(2, top + half, w - 4, half, c.light),
    )
  }
  return paints
}

/**
 * **안쪽 칸 `0xbb28c(x, y, w, h, 정렬)`** 의 칠 목록 (정렬로 옮긴 뒤 왼쪽 위 = (0, 0)). R = w − 1 · B = h − 1:
 * ```
 * bb2ea  칠 (0, 0, w, h) #1D44A8
 * bb318  선 (R, 0)–(R, B) #5A86FF · bb33a 선 (0, B)–(R, B) #5A86FF
 * bb35c  선 (0, 0)–(R, 0) #08246B · bb37e 선 (0, 0)–(0, B) #08246B
 * ```
 * 곧 들어간 칸 — 위·왼쪽이 어둡고(오른쪽 위 · 왼쪽 아래 끝 점도 어둡다) 오른쪽·아래가 밝다.
 */
export function insetBoxPaintsOf(w: number, h: number): PanelPaint[] {
  const right = w - 1
  const bottom = h - 1
  const c = INSET_BOX_COLORS
  return [
    ...fill(0, 0, w, h, c.fill),
    ...line(right, 0, right, bottom, c.lit),
    ...line(0, bottom, right, bottom, c.lit),
    ...line(0, 0, right, 0, c.shade),
    ...line(0, 0, 0, bottom, c.shade),
  ]
}

/** 정렬 비트 (0xb9d74 와 같다 — 0x55ec8~0x55efc · 0xbb29c~0xbb2c8): 0x2 가로 가운데 · 0x4 오른쪽 · 0x20 세로 가운데 · 0x40 아래 */
export function alignedTopLeftOf(x: number, y: number, w: number, h: number, align: number): { x: number; y: number } {
  let left = x
  let top = y
  if ((align & 0x2) !== 0) left -= w >> 1
  if ((align & 0x4) !== 0) left -= w
  if ((align & 0x20) !== 0) top -= h >> 1
  if ((align & 0x40) !== 0) top -= h
  return { x: left, y: top }
}

/** 둥근 테두리 0x6aa64 — 둥글기 ≤ 3 은 선 넷, 4~7 은 선 넷(두 칸 안쪽) + 안쪽 모서리 점 넷 (0x6ab10~0x6abd4). 7 보다 크면 7 */
function roundEdgeOf(x: number, y: number, w: number, h: number, round: number, color: string): PanelPaint[] {
  if (Math.min(7, round) <= 3) return roundEdge(x, y, w, h, color)
  const right = x + w
  const bottom = y + h
  return [
    ...line(x + 2, y, right - 2, y, color),
    ...line(x + 2, bottom, right - 2, bottom, color),
    ...line(x, y + 2, x, bottom - 2, color),
    ...line(right, y + 2, right, bottom - 2, color),
    ...fill(x + 1, y + 1, 1, 1, color),
    ...fill(right - 1, y + 1, 1, 1, color),
    ...fill(x + 1, bottom - 1, 1, 1, color),
    ...fill(right - 1, bottom - 1, 1, 1, color),
  ]
}

/**
 * 둥근 칠 0x6b7d4 — 칠(x+1, y+1, w−1, h−1) 위에 선 넷. 둥글기 ≤ 3 은 한 칸 안쪽, 4~7 은 두 칸 안쪽에서 선을 시작한다
 * (`widgets/batting-stage` 의 `roundFillRectsOf` 와 같은 식).
 */
function roundFillOf(x: number, y: number, w: number, h: number, round: number, color: string): PanelPaint[] {
  if (Math.min(7, round) <= 3) return roundFill(x, y, w, h, color)
  const right = x + w
  const bottom = y + h
  return [
    ...fill(x + 1, y + 1, w - 1, h - 1, color),
    ...line(x + 2, y, right - 2, y, color),
    ...line(x + 2, bottom, right - 2, bottom, color),
    ...line(x, y + 2, x, bottom - 2, color),
    ...line(right, y + 2, right, bottom - 2, color),
  ]
}

/** 0x5eec4 머리 반사 줄의 회색 표 0xd1c44 = [255, 255, 222, 222] — 회색 g 는 RGB(g, g, g) (0x5f016~0x5f022) */
const ROUND_BOX_SHINE_GREYS = ['#FFFFFF', '#FFFFFF', '#DEDEDE', '#DEDEDE'] as const

export interface RoundBoxOptions {
  readonly width: number
  readonly height: number
  /** 다섯째 인자 [sp+0x44] — 둥글기. 0 이하면 1 */
  readonly round: number
  /** 일곱째 인자 [sp+0x4c](u8) — ≠ 0 이면 왼쪽 위에 머리 반사 줄을 긋는다 */
  readonly shine?: boolean
  /** 여덟째 인자 [sp+0x50] — 반사 줄 길이. 9 이하면 10 */
  readonly shineLength?: number
  /** 아홉째 인자 [sp+0x54] — 줄마다 줄어드는 길이 */
  readonly shineStep?: number
  /** 열둘째 인자 [sp+0x64] — ≠ 0 이면 회색 묶음마다 줄을 하나 덜 긋는다 */
  readonly shortShine?: boolean
  /** 열째 인자 [sp+0x5c] — 칠 색 */
  readonly fill: string
  /** 열한째 인자 [sp+0x60] — 테두리 색 */
  readonly edge: string
}

/**
 * **둥근 칸 `0x5eec4(?, x, y, w, h, 둥글기, 정렬, 반사, 반사 길이, 걸음, ?, 칠 색, 테두리 색, 짧게)`** 의 칠 목록
 * (정렬로 옮긴 뒤 왼쪽 위 = (0, 0)) — 0x5eec4~0x5f118 을 직접 떴다. 정렬 비트는 0xb9d74 와 같다(0x5eef6~0x5ef2c).
 * 첫 인자는 안 읽고 그림판은 [0x1400070] 이다. 열째 인자 [sp+0x58] 도 안 읽는다.
 * ```
 * 5ef4c  둥근 칠 0x6b7d4(x, y, w, h, 둥글기, 칠 색)                 ; w+1 × h+1
 * 5ef66  둥근 테두리 0x6aa64(x, y, w, h, 둥글기, 테두리 색)
 * 5ef6c  둥글기 == 1 이면 테두리 색 점 넷 (x+1, y+1) · (x+w−1, y+1) · (x+w−1, y+h−1) · (x+1, y+h−1)
 * 5efba  반사 ≠ 0 이면 (L = 반사 길이, 9 이하면 10):
 *          선 #DED7DE (x+2, y+1)–(x+w−2, y+1) · 선 #FFFFFF (x+2, y+2)–(x+w−1, y+2)
 *          줄 y = y+3 부터, 깎음 a = 0 부터, i = 0..3 회색 g = 0xd1c44[i]:
 *            줄 셋(짧게면 i ≤ 2 만 셋 · i = 3 은 둘) — 선 g (x+1, y)–(x+L−a+1, y) · y += 1 · a += 걸음
 *            (짧게가 아니면 끝 x < x+1 인 줄은 안 긋고, i = 3 은 넷째 줄을 하나 더 긋는다)
 * ```
 */
export function roundBoxPaintsOf({
  width: w, height: h, round: rawRound, shine = false, shineLength = 0, shineStep = 0, shortShine = false, fill: fillColor, edge,
}: RoundBoxOptions): PanelPaint[] {
  const round = rawRound <= 0 ? 1 : rawRound
  const paints: PanelPaint[] = [...roundFillOf(0, 0, w, h, round, fillColor), ...roundEdgeOf(0, 0, w, h, round, edge)]
  if (round === 1) {
    paints.push(...fill(1, 1, 1, 1, edge), ...fill(w - 1, 1, 1, 1, edge), ...fill(w - 1, h - 1, 1, 1, edge), ...fill(1, h - 1, 1, 1, edge))
  }
  if (!shine) return paints
  const length = shineLength > 9 ? shineLength : 10
  paints.push(...line(2, 1, w - 2, 1, '#DED7DE'), ...line(2, 2, w - 1, 2, '#FFFFFF'))
  let row = 3
  let cut = 0
  const shineLine = (grey: string, checked: boolean) => {
    const end = length - cut + 1
    if (!checked || end >= 1) paints.push(...line(1, row, end, row, grey))
    row += 1
    cut += shineStep
  }
  for (let i = 0; i <= 3; i += 1) {
    const grey = ROUND_BOX_SHINE_GREYS[i]!
    shineLine(grey, true)
    shineLine(grey, true)
    if (!shortShine) {
      shineLine(grey, true)
      if (i === 3) shineLine(grey, true)
    } else if (i <= 2) {
      shineLine(grey, false)
    }
  }
  return paints
}
