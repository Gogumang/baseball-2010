/** 칸 바탕 색 — `[0x1400748](0x30, 0x45, 0xcd)` (0x7a844~0x7a84c) */
export const GRID_CELL_BACK_COLOR = '#3045CD'

/**
 * 공용 격자 0x7a571 의 **칸 바탕** — 시작 0x7a005 의 넷째 인자 [격자+8] 이 선 격자만, 보이는 칸마다 내용보다 먼저
 * `0x6b7d5(gfx, x − 3, y − 3, 칸너비 + 3, 줄높이 + 3, 둥글기 1, 색)` 을 깐다 (0x7a7da~0x7a89c). 고른 칸은 커서 튕김을 먼저 더한 자리다.
 * 0x6b7d5 는 (w + 1)×(h + 1) 에서 네 모서리 점이 빠진 꼴이다 — 두 겹 사각형으로 그린다.
 */
export function GridCellBack({
  x,
  y,
  width,
  height,
  className,
}: {
  /** 칸 자리 (x[i], y[i]) */
  readonly x: number
  readonly y: number
  /** 칸너비 · 줄높이 */
  readonly width: number
  readonly height: number
  readonly className: string
}) {
  const w = width + 3
  const h = height + 3
  return (
    <>
      <span
        className={className}
        data-part="칸바탕"
        style={{ left: x - 3 + 1, top: y - 3, width: w - 1, height: h + 1, background: GRID_CELL_BACK_COLOR }}
      />
      <span className={className} style={{ left: x - 3, top: y - 3 + 1, width: w + 1, height: h - 1, background: GRID_CELL_BACK_COLOR }} />
    </>
  )
}
