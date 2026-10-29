import { PressArea } from '@/shared/ui'
import { ENTRY_LIST_LAYOUT, entryRowYOf } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryListGeometry } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryListRow } from '@/widgets/entry-editor/ui/entryListWindow/entryListRow'

export type EntryArrowDirection = '위' | '아래' | '왼' | '오른'

interface EntryListPressesProps {
  readonly geometry: EntryListGeometry
  readonly rows: readonly EntryListRow[]
  readonly top: number
  readonly cursor: number
  readonly onPressRow: ((index: number) => void) | undefined
  readonly onPressArrow: ((direction: EntryArrowDirection) => void) | undefined
  readonly hasVerticalArrows: boolean
}

/** 웹 전용 누름 칸 — 줄 · ▲▼ · 옆 화살 그림 자리 */
export function EntryListPresses({ geometry, rows, top, cursor, onPressRow, onPressArrow, hasVerticalArrows }: EntryListPressesProps) {
  const L = ENTRY_LIST_LAYOUT
  const rowLeft = L.originX
  const rowWidth = geometry.clip.x + geometry.clip.width - rowLeft
  return (
    <>
      {onPressRow !== undefined &&
        rows.map((row, offset) => {
          const index = top + offset
          return (
            <PressArea
              key={index}
              label={row.name}
              testId={`엔트리-줄-${index}`}
              option={{ isSelected: index === cursor }}
              rect={{ x: rowLeft, y: entryRowYOf(index, top), width: rowWidth, height: L.cellHeight }}
              onPress={() => onPressRow(index)}
            />
          )
        })}
      {onPressArrow !== undefined && <ArrowPresses geometry={geometry} onPressArrow={onPressArrow} hasVerticalArrows={hasVerticalArrows} />}
    </>
  )
}

/** ▲▼ · 옆 화살 누름 칸 — 그림이 선 화살만 */
function ArrowPresses({
  geometry,
  onPressArrow,
  hasVerticalArrows,
}: Pick<EntryListPressesProps, 'geometry' | 'hasVerticalArrows'> & { readonly onPressArrow: (direction: EntryArrowDirection) => void }) {
  const L = ENTRY_LIST_LAYOUT
  const { leftArrow, rightArrow } = geometry
  return (
    <>
      {hasVerticalArrows && (
        <>
          <PressArea label="위" rect={{ x: L.arrowX - 2, y: L.upArrowY - 4, width: 17, height: 12 }} onPress={() => onPressArrow('위')} />
          <PressArea label="아래" rect={{ x: L.arrowX - 2, y: L.downArrowY, width: 17, height: 12 }} onPress={() => onPressArrow('아래')} />
        </>
      )}
      {leftArrow !== null && (
        <PressArea label="앞 열" rect={{ x: leftArrow.x - 3, y: leftArrow.y - 2, width: 9, height: 12 }} onPress={() => onPressArrow('왼')} />
      )}
      {rightArrow !== null && (
        <PressArea label="다음 열" rect={{ x: rightArrow.x - 1, y: rightArrow.y - 2, width: 9, height: 12 }} onPress={() => onPressArrow('오른')} />
      )}
    </>
  )
}
