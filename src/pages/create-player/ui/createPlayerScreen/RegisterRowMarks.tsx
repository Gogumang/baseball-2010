import { InputModeBox } from '@/shared/ui/InputMethodText/InputModeBox'
import { INFO_CELLS } from '@/pages/create-player/lib/createPlayerLayout'
import type { CreatePlayerRowId, SelectableRowId } from '@/pages/create-player/lib/createPlayerLayout'
import { ArrowButton } from './ArrowButton'

/**
 * 고른 줄 표시 — 이름 줄(줄 0)이면 입력 방식 칸 0xba0bd · 화살(0x160e8~0x161f4, 투수 등록과 같은 그리기 0x15f34 갈래),
 * 그 밖의 줄이면 값 칸 양옆 화살표 (0x160a8) — 이름 줄에는 고를 값이 없다
 */
export function RegisterRowMarks({
  selectedId,
  onChangeValue,
}: {
  readonly selectedId: SelectableRowId
  readonly onChangeValue: (rowId: CreatePlayerRowId, step: number) => void
}) {
  if (selectedId === '이름') {
    const nameCell = INFO_CELLS.find((cell) => cell.id === '이름')
    return nameCell === undefined ? null : <InputModeBox nameBox={nameCell.value} />
  }
  return (
    <>
      <ArrowButton rowId={selectedId} step={-1} onPress={onChangeValue} />
      <ArrowButton rowId={selectedId} step={1} onPress={onChangeValue} />
    </>
  )
}
