import type { CSSProperties } from 'react'
import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ENTRY_LIST_LAYOUT, entryRowYOf } from '@/widgets/entry-editor/lib/entryListWindow'
import type { PlacedEntryColumn } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryListRow } from '@/widgets/entry-editor/ui/entryListWindow/entryListRow'
import { CellContent } from '@/widgets/entry-editor/ui/entryListWindow/EntryCellContent'
import { CenteredImgText } from '@/widgets/entry-editor/ui/entryListWindow/entryListAtoms'
import { GAME_UI_FRAMES } from '@/widgets/entry-editor/ui/entryListWindow/entryListAssets'

export interface ColumnCellsProps {
  readonly placed: PlacedEntryColumn
  readonly rows: readonly EntryListRow[]
  readonly top: number
  readonly gameUi: FrameOrigins | null
  readonly imgText: FrameOrigins | null
  readonly palette3: CSSProperties
  readonly showsNameBars: boolean
}

/** 한 열 — 머리 글(팔레트 3) · 줄마다 칸과 내용 */
export function EntryColumnCells({ placed, rows, top, gameUi, imgText, palette3, showsNameBars }: ColumnCellsProps) {
  const { column, x } = placed
  const L = ENTRY_LIST_LAYOUT
  return (
    <div data-testid={`엔트리-열-${column.kind}-${column.word.toString(16)}`}>
      <CenteredImgText origins={imgText} frame={column.headerFrame} x={x} y={L.headerY} width={column.width} style={palette3} />
      {rows.map((row, offset) => {
        const index = top + offset
        const y = entryRowYOf(index, top)
        return (
          <div key={index} data-testid={`엔트리-칸-${index}-${column.kind}`} aria-label={row.name}>
            <FrameSprite folder={GAME_UI_FRAMES} frame={column.cellFrame} origins={gameUi} x={x} y={y} />
            <CellContent placed={placed} row={row} index={index} y={y} gameUi={gameUi} imgText={imgText} showsNameBars={showsNameBars} />
          </div>
        )
      })}
    </div>
  )
}
