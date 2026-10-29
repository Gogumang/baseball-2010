interface PlainRect {
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
 * **둥근 칠 `0x6b7d4(gfx, x, y, w, h, 둥글기, 색)`** — `widgets/matchup-cards` 의 `roundFillRectsOf` 와 같은 식이다
 * (위젯끼리 import 하지 않으려고 베꼈다). 둥글기는 7 로 자르고, R = x + w · B = y + h.
 * ```
 * 둥글기 ≤ 3:  칠(x+1, y+1, w−1, h−1) · 선(x+1, y, R−1, y) · 선(x+1, B, R−1, B) · 선(x, y+1, x, B−1) · 선(R, y+1, R, B−1)
 * 둥글기 4~7:  칠(x+1, y+1, w−1, h−1) · 선(x+2, y, R−2, y) · 선(x+2, B, R−2, B) · 선(x, y+2, x, B−2) · 선(R, y+2, R, B−2)
 * ```
 * 그래서 둥근 칠은 (w+1) × (h+1) 칸을 덮고 모서리를 1칸(≤3) 또는 ㄱ자 3칸(4~7) 비운다.
 */
export function roundFillRectsOf(rect: PlainRect, round: number): PlainRect[] {
  const { x, y, width: w, height: h } = rect
  const right = x + w
  const bottom = y + h
  const inset = Math.min(7, round) <= 3 ? 1 : 2
  const body: PlainRect[] = w - 1 > 0 && h - 1 > 0 ? [{ x: x + 1, y: y + 1, width: w - 1, height: h - 1 }] : []
  return [
    ...body,
    lineRect(x + inset, y, right - inset, y),
    lineRect(x + inset, bottom, right - inset, bottom),
    lineRect(x, y + inset, x, bottom - inset),
    lineRect(right, y + inset, right, bottom - inset),
  ]
}

export function fillRound(context: CanvasRenderingContext2D, rect: PlainRect, round: number, color: string): void {
  context.fillStyle = color
  for (const part of roundFillRectsOf(rect, round)) context.fillRect(part.x, part.y, part.width, part.height)
}
