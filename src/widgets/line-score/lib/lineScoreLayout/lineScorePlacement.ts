import {
  centeredNumberGlyphsOf,
  inningRunsAt,
  isLineScoreCursorShown,
  isLineScoreTotalShown,
} from '@/widgets/line-score/lib/lineScoreLayout/lineScoreCells'
import {
  CELL,
  CELL_STEP,
  LINE_SCORE_COLORS,
  LINE_SCORE_IMAGES,
  LINE_SCORE_INNINGS,
  LINE_SCORE_NUMBER_BASE,
  LINE_SCORE_PANEL,
} from '@/widgets/line-score/lib/lineScoreLayout/lineScoreConstants'
import type {
  LineScoreGlyph,
  LineScoreImage,
  LineScorePlacement,
  LineScoreRect,
  LineScoreState,
} from '@/widgets/line-score/lib/lineScoreLayout/lineScoreTypes'
import { panelRectsOf, roundFill } from '@/widgets/line-score/lib/lineScoreLayout/panelRects'

/** 0x41c18 의 그림 자리 — (x, y) 는 부르는 곳(`LINE_SCORE_AT`) */
export function lineScorePlacementOf(x: number, y: number, state: LineScoreState): LineScorePlacement {
  const first = Math.max(0, state.inning - 8)
  const rows = [y + 0x15, y + 0x24] as const
  const rects: LineScoreRect[] = [
    ...panelRectsOf(x, y, LINE_SCORE_PANEL.width, LINE_SCORE_PANEL.height),
    ...roundFill(x + 0x17, y + 0x14, 0xb5, 0x1e, LINE_SCORE_COLORS.plate),
  ]
  const runs: LineScoreGlyph[] = []
  for (const side of [0, 1] as const) {
    const cells = inningCellsOf(x, rows[side], side, first, state)
    rects.push(...cells.rects)
    runs.push(...cells.runs)
  }
  const totalCell = { x: x + 0xb1, width: 0x1b, height: 0xe }
  rects.push({ ...totalCell, y: rows[0], color: LINE_SCORE_COLORS.cell }, { ...totalCell, y: rows[1], color: LINE_SCORE_COLORS.cell })
  return {
    rects,
    images: lineScoreImagesOf(x, y, first, state),
    logos: [
      { x: x + 8, y: y + 0x16 },
      { x: x + 8, y: y + 0x25 },
    ],
    inningNumbers: inningNumbersOf(x, y, first),
    runs,
    totals: totalGlyphsOf(totalCell, rows, state),
  }
}

/** 41d58 — 보이는 아홉 칸의 이닝 번호 (num 50~) */
function inningNumbersOf(x: number, y: number, first: number): LineScoreGlyph[] {
  const inningNumbers: LineScoreGlyph[] = []
  for (let k = 0; k < LINE_SCORE_INNINGS; k += 1) {
    inningNumbers.push(...centeredNumberGlyphsOf(first + k + 1, x + 0x21 + CELL_STEP * k, y + 8, LINE_SCORE_NUMBER_BASE.inning))
  }
  return inningNumbers
}

/** 측 하나의 아홉 칸 (41dba · 41e78) — 칸은 늘 칠하고, 점수는 그 이닝이 열렸을 때만 */
function inningCellsOf(
  x: number,
  rowY: number,
  side: 0 | 1,
  first: number,
  state: LineScoreState,
): { rects: LineScoreRect[]; runs: LineScoreGlyph[] } {
  const rects: LineScoreRect[] = []
  const runs: LineScoreGlyph[] = []
  for (let k = 0; k < LINE_SCORE_INNINGS; k += 1) {
    const inning = first + k
    const cellX = x + 0x18 + CELL_STEP * k
    rects.push({ x: cellX, y: rowY, ...CELL, color: LINE_SCORE_COLORS.cell })
    if (!isInningRunsShown(side, inning, state)) continue
    runs.push(
      ...centeredNumberGlyphsOf(inningRunsAt(state.inningRuns, inning, side), cellX + (CELL.width >> 1), rowY + 2, LINE_SCORE_NUMBER_BASE.runs),
    )
  }
  return { rects, runs }
}

/** 측 0 은 지금 이닝까지, 측 1 은 앞 이닝까지 + 지금 이닝은 말 공격 중일 때 (41dba · 41e78) */
function isInningRunsShown(side: 0 | 1, inning: number, state: LineScoreState): boolean {
  if (side === 0) return inning <= state.inning
  return inning < state.inning || (inning === state.inning && state.offenseSide === 1)
}

/** 41fb8 — 합 두 글자 (경기 끝이면 깜빡) */
function totalGlyphsOf(
  totalCell: { readonly x: number; readonly width: number },
  rows: readonly [number, number],
  state: LineScoreState,
): LineScoreGlyph[] {
  if (!isLineScoreTotalShown(state.isGameOver, state.tick)) return []
  return ([0, 1] as const).flatMap((side) =>
    centeredNumberGlyphsOf(state.totals[side], totalCell.x + (totalCell.width >> 1), rows[side] + 2, LINE_SCORE_NUMBER_BASE.runs),
  )
}

/** 41cfa "R" · 42040 지금 칸 노란 테 (경기 끝이 아니고 10틱에 한 번 꺼진다) */
function lineScoreImagesOf(x: number, y: number, first: number, state: LineScoreState): LineScoreImage[] {
  const images: LineScoreImage[] = [{ image: LINE_SCORE_IMAGES.runsHeader, x: x + 0xba, y: y + 8 }]
  if (!isLineScoreCursorShown(state.isGameOver, state.tick)) return images
  images.push({
    image: LINE_SCORE_IMAGES.cursor,
    x: x + 0x15 + CELL_STEP * (state.inning - first),
    y: state.offenseSide === 1 ? y + 0x21 : y + 0x12,
  })
  return images
}
