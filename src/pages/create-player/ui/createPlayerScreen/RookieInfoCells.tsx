import { InputMethodText } from '@/shared/ui'
import { inputModeLayoutOf } from '@/shared/ui/InputMethodText/inputModeLayout'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { MAXIMUM_NAME_BYTES, nameByteLengthOf } from '@/entities/career/model/playerCareer'
import { CURSOR_COLOR, INFO_CELLS, ROW_ORDER } from '@/pages/create-player/lib/createPlayerLayout'
import type { InfoCellId, SelectableRowId } from '@/pages/create-player/lib/createPlayerLayout'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'
import { IMG_TEXT, frameSrc } from './createPlayerAssets'

type InfoCell = (typeof INFO_CELLS)[number]

/**
 * 이름 글 0x677d5(입력기, 값 칸 x + 2, y + 3, 앱 글꼴, RGB(255,255,0), 줄 == 0, 정렬 0x11, 0) — 0x16128~0x16152.
 * 노랑 · 왼쪽 맞춤 · 이름 줄일 때 '|' 커서. 예전 웹은 흰 글 가운데 맞춤이었다. 이름은 CP949 8바이트까지 (R11 1b — 한글 2바이트 · 그 밖 1바이트, 섞어 써도 된다)
 */
function NameInput({
  cell,
  name,
  isCursorOn,
  onName,
  onFocus,
}: {
  readonly cell: InfoCell
  readonly name: string
  readonly isCursorOn: boolean
  readonly onName: (name: string) => void
  readonly onFocus: () => void
}) {
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <InputMethodText
        value={name}
        autoFocus
        aria-label="이름"
        x={cell.value.x + 2}
        y={cell.value.y + 3}
        color={CURSOR_COLOR}
        isCursorOn={isCursorOn}
        // 투명 입력 칸은 입력 방식 칸 M(0x1615c) 앞에서 끊는다 — 투수 등록과 같다
        inputRect={{ ...cell.value, width: inputModeLayoutOf(cell.value).box.x - cell.value.x - 1 }}
        onFocus={onFocus}
        onChange={(event) => {
          if (nameByteLengthOf(event.target.value) <= MAXIMUM_NAME_BYTES) onName(event.target.value)
        }}
      />
    </form>
  )
}

/** 정보 칸 0x7c450 — 이름표는 img_text 그림을 오른쪽 정렬로, 값은 글(타순만 노란 숫자). 고르는 줄의 값 칸은 눌러서 그 줄로 간다 */
export function RookieInfoCells({
  name,
  valueOf,
  selectedId,
  labelOrigins,
  onName,
  onSelectRow,
}: {
  readonly name: string
  readonly valueOf: (id: InfoCellId) => string
  readonly selectedId: SelectableRowId
  readonly labelOrigins: FrameOrigins | null
  readonly onName: (name: string) => void
  readonly onSelectRow: (row: number) => void
}) {
  const labelWidthOf = (frame: number) => labelOrigins?.[String(frame).padStart(3, '0')]?.width ?? 0
  return INFO_CELLS.map((cell) => {
    const value = valueOf(cell.id)
    return (
      <div key={cell.id}>
        <img
          className={styles.layer}
          alt=""
          src={frameSrc(IMG_TEXT, cell.labelFrame)}
          style={{ left: cell.label.x + cell.label.width - labelWidthOf(cell.labelFrame), top: cell.value.y + 3 }}
        />
        {cell.id === '이름' ? (
          <NameInput
            cell={cell}
            name={name}
            isCursorOn={selectedId === '이름'}
            onName={onName}
            onFocus={() => onSelectRow(ROW_ORDER.indexOf('이름'))}
          />
        ) : (
          <div
            className={styles.infoValue}
            style={{
              left: cell.value.x,
              top: cell.value.y,
              width: cell.value.width,
              height: cell.value.height,
              color: cell.id === '타순' ? CURSOR_COLOR : undefined,
            }}
          >
            {value}
          </div>
        )}
        {cell.rowIndex !== null && cell.id !== '이름' && (
          <button
            type="button"
            className={styles.valueButton}
            aria-label={`${cell.id} ${value}`}
            style={{ left: cell.value.x, top: cell.value.y, width: cell.value.width, height: cell.value.height }}
            onClick={() => onSelectRow(cell.rowIndex ?? 0)}
          />
        )}
      </div>
    )
  })
}
