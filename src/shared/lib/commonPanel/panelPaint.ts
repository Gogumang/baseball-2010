export interface PanelPaint {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

export const fill = (x: number, y: number, width: number, height: number, color: string): PanelPaint[] =>
  width > 0 && height > 0 ? [{ x, y, width, height, color }] : []

/** 빗선 — 브레젠험 점들 (두 끝 포함, 이 파일은 45° 만 쓴다) */
function bresenhamPaints(x1: number, y1: number, x2: number, y2: number, color: string): PanelPaint[] {
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
    if (doubled >= dy) {
      error += dy
      x += sx
    }
    if (doubled <= dx) {
      error += dx
      y += sy
    }
  }
}

/** 기기 선 — 가로·세로면 한 칸, 그 밖은 브레젠험 점들 */
export function line(x1: number, y1: number, x2: number, y2: number, color: string): PanelPaint[] {
  if (x1 !== x2 && y1 !== y2) return bresenhamPaints(x1, y1, x2, y2, color)
  return [{ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1) + 1, height: Math.abs(y2 - y1) + 1, color }]
}

/** 둥근 테두리 0x6aa64 (둥글기 ≤ 3) */
export function roundEdge(x: number, y: number, w: number, h: number, color: string): PanelPaint[] {
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
export const roundFill = (x: number, y: number, w: number, h: number, color: string): PanelPaint[] => [
  ...fill(x + 1, y + 1, w - 1, h - 1, color),
  ...roundEdge(x, y, w, h, color),
]

/**
 * 둥근 테두리 0x6aa64(x, y, w, h, 둥글기 ≤ 3, 색) 의 칠 목록 — 왼쪽 위 = (0, 0), (w + 1) × (h + 1) 을 덮는다.
 * 0xba015(상자, 둥글기, 색) 가 이것을 부른다(0xba05e).
 */
export const roundEdgePaintsOf = (w: number, h: number, color: string): PanelPaint[] => roundEdge(0, 0, w, h, color)

/** 둥근 칠 0x6b7d4(둥글기 ≤ 3) 의 칠 목록 — 0xba0bd(상자, 둥글기, 색) 가 이것을 부른다(0xba106). (w + 1) × (h + 1) */
export const roundFillPaintsOf = (w: number, h: number, color: string): PanelPaint[] => roundFill(0, 0, w, h, color)

/** 둥근 테두리 0x6aa64 — 둥글기 ≤ 3 은 선 넷, 4~7 은 선 넷(두 칸 안쪽) + 안쪽 모서리 점 넷 (0x6ab10~0x6abd4). 7 보다 크면 7 */
export function roundEdgeOf(x: number, y: number, w: number, h: number, round: number, color: string): PanelPaint[] {
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
export function roundFillOf(x: number, y: number, w: number, h: number, round: number, color: string): PanelPaint[] {
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
