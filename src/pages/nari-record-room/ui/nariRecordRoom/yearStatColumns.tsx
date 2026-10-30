/** 124 첫 갈래 목록의 넘기는 열 (0x56ebc · 숫자 0x6aff8) */
import type { CSSProperties } from 'react'
import { VISIBLE_YEAR_COLUMNS, YEAR_TABLE_LAYOUT, yearCellDrawingOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { YearRecordColumn, YearRecordView } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { DOT_COLOR, GAME_UI_FRAMES, NUM, STAT_CELL_FRAME, imageOf, pixel } from '@/pages/nari-record-room/ui/nariRecordRoom/yearRecordConstants'
import type { YearRow } from '@/pages/nari-record-room/ui/nariRecordRoom/yearRecordConstants'
import { YearLabel } from '@/pages/nari-record-room/ui/nariRecordRoom/yearTableParts'

const layout = YEAR_TABLE_LAYOUT
const rowYOf = (offsetRow: number) => layout.firstRowY + offsetRow * layout.rowStep

/** 넘기는 열 0x56ebc — 자르기 0xbae25 안에 첫 열 − 1 부터 첫 열 + 보이는 열까지 (0x5cdae) */
export function YearStatColumns({
  columns,
  rows,
  view,
  offset,
  palette,
}: {
  readonly columns: readonly YearRecordColumn[]
  readonly rows: readonly YearRow[]
  readonly view: YearRecordView
  readonly offset: number
  readonly palette: CSSProperties
}) {
  const drawn = columns
    .map((column, index) => ({ column, index }))
    .filter(({ index }) => index >= view.firstColumn - 1 && index <= view.firstColumn + VISIBLE_YEAR_COLUMNS)
  return (
    <div style={{ ...pixel, left: layout.clip.x, top: layout.clip.y, width: layout.clip.width, height: layout.clip.height, overflow: 'hidden' }}>
      {drawn.map(({ column, index }) => {
        const left = layout.statX - layout.clip.x + (index - view.firstColumn) * layout.columnStep + offset
        return (
          <div key={column.bit} data-testid={`개인기록-열-${column.label}`} style={{ ...pixel, left, top: -layout.clip.y }}>
            <YearLabel frame={column.labelFrame} x={0} width={layout.statWidth} alt={column.label} palette={palette} />
            {rows.map((row, offsetRow) => (
              <YearStatCell
                key={view.top + offsetRow}
                row={row}
                bit={column.bit}
                label={column.label}
                rowIndex={view.top + offsetRow}
                top={rowYOf(offsetRow)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** 넘기는 칸 하나 — 칸 그림 0x23 (x, y) · 숫자 0x6aff8(x + 24, y + 3, …) */
function YearStatCell({ row, bit, label, rowIndex, top }: { row: YearRow; bit: number; label: string; rowIndex: number; top: number }) {
  const number = row.numberOf(bit)
  const drawing = number === null ? null : yearCellDrawingOf(number)
  return (
    <div data-testid={`개인기록-칸-${rowIndex}-${label}`} aria-label={row.textOf(bit) ?? ''}>
      <img alt="" src={imageOf(GAME_UI_FRAMES, STAT_CELL_FRAME)} style={{ ...pixel, left: 0, top }} />
      {drawing?.glyphs.map((glyph, glyphIndex) => (
        <img key={glyphIndex} alt="" src={imageOf(NUM, glyph.frame)} style={{ ...pixel, left: glyph.x, top: top + 3 }} />
      ))}
      {drawing?.dots.map((dot, dotIndex) => (
        <span key={dotIndex} style={{ ...pixel, left: dot.x, top: top + dot.y, width: 1, height: 2, background: DOT_COLOR }} />
      ))}
    </div>
  )
}
