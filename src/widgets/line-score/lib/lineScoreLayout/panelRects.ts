import { LINE_SCORE_COLORS } from '@/widgets/line-score/lib/lineScoreLayout/lineScoreConstants'
import type { LineScoreRect } from '@/widgets/line-score/lib/lineScoreLayout/lineScoreTypes'

/** 둥근 칠 0x6b7d4 · 0xba0bd(둥글기 1) — (w+1)×(h+1) 에서 네 모서리 점이 빠진 꼴 (`roundPlateRectsOf` 와 같다) */
export function roundFill(x: number, y: number, width: number, height: number, color: string): LineScoreRect[] {
  return [
    { x: x + 1, y, width: width - 1, height: height + 1, color },
    { x, y: y + 1, width: width + 1, height: height - 1, color },
  ]
}

/** 둥근 테 0x6aa64(둥글기 1) — R = x + w · B = y + h 일 때 (x+1..R−1, y) · (x+1..R−1, B) · (x, y+1..B−1) · (R, y+1..B−1) */
function roundOutline(x: number, y: number, width: number, height: number, color: string): LineScoreRect[] {
  return [
    { x: x + 1, y, width: width - 1, height: 1, color },
    { x: x + 1, y: y + height, width: width - 1, height: 1, color },
    { x, y: y + 1, width: 1, height: height - 1, color },
    { x: x + width, y: y + 1, width: 1, height: height - 1, color },
  ]
}

const dot = (x: number, y: number, color: string): LineScoreRect => ({ x, y, width: 1, height: 1, color })

/**
 * **판 0x5461c(skin, x, y, w, h)** — 직접 떴다(0x5461c~0x54756):
 * ```
 * 54648  0x6b7d5(x, y, w, h, 둥글기 1, RGB(8, 0x1c, 0x4a))
 * 54674  0x6aa65(x+1, y+1, w−2, h−2, 둥글기 1, RGB(0x33, 0x5f, 0xcd))          ; 테
 * 54698  0x6a8a9 점 (x+2, y+2) · (x+w−2, y+2) · (x+2, y+h−2) · (x+w−2, y+h−2) 같은 색
 * 5471e  0x6b7d5(x+2, y+2, w−4, h−4, 둥글기 1, 흰색)
 * 5474a  0x6b7d5(x+4, y+4, w−8, h−8, 둥글기 1, RGB(0x33, 0x5f, 0xcd))
 * ```
 */
export function panelRectsOf(x: number, y: number, width: number, height: number): LineScoreRect[] {
  const blue = LINE_SCORE_COLORS.panelBlue
  return [
    ...roundFill(x, y, width, height, LINE_SCORE_COLORS.panelOuter),
    ...roundOutline(x + 1, y + 1, width - 2, height - 2, blue),
    dot(x + 2, y + 2, blue),
    dot(x + width - 2, y + 2, blue),
    dot(x + 2, y + height - 2, blue),
    dot(x + width - 2, y + height - 2, blue),
    ...roundFill(x + 2, y + 2, width - 4, height - 4, LINE_SCORE_COLORS.panelWhite),
    ...roundFill(x + 4, y + 4, width - 8, height - 8, blue),
  ]
}
