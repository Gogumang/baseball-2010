import type { HallOfFameSide } from '@/entities/collection/model/collection'
import {
  HALL_OF_FAME_CELL_ART,
  HALL_OF_FAME_GRID,
  SLT_FRAME,
  hallOfFameCellImageTopLeftOf,
  hallOfFameCellImagesOf,
  hallOfFameCellOf,
  isHallOfFameCellDimmed,
} from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { gridOpenCellDy } from '@/shared/lib/gridOpen/gridOpen'
import type { GridOpenDraw, GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'
import type { GridBounceOffset } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { imageSrc } from '@/pages/special/ui/specialScreen/specialAssets'
import type { HallOfFameGridView } from '@/pages/special/ui/hallOfFameScreen/hallOfFameGridView'
import type { HallOfFameSlotView } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

const NO_SHAKE = { dx: 0, dy: 0 }

/** 찬 칸 몸 그림의 타입(폼 / 2) — 칸 그림 고르기에 쓴다 */
const typeIndexOf = (entry: HallOfFameSlotView) => (entry.kind === '찬칸' && entry.figure !== null ? entry.figure.form >> 1 : null)

/** 다른 편 덮개 — 0x6b7d5(gfx, x, y, 39, 38, 둥글기 1, 0x80000000): (w + 1)×(h + 1) 에서 네 모서리 점이 빠진 꼴, 한 겹이라 clip-path 로 깎는다 */
function CellDim() {
  return (
    <span
      className={styles.hofCellDim}
      data-part="덮개"
      style={{
        width: HALL_OF_FAME_CELL_ART.frame.width + 1,
        height: HALL_OF_FAME_CELL_ART.frame.height + 1,
        opacity: HALL_OF_FAME_CELL_ART.dimOpacity,
      }}
    />
  )
}

interface HallOfFameCellProps {
  readonly index: number
  readonly entry: HallOfFameSlotView
  readonly view: HallOfFameGridView
  readonly isCurrent: boolean
  readonly shake: GridBounceOffset
  readonly dy: number
  readonly isDimmed: boolean
  readonly onPick: (index: number) => void
}

/** 칸 하나 — 칸 틀 · 상태 그림 · (145) 다른 편 덮개 */
function HallOfFameCell({ index, entry, view, isCurrent, shake, dy, isDimmed, onPick }: HallOfFameCellProps) {
  const box = hallOfFameCellOf(index - view.firstSlot, view.firstRowY)
  return (
    <button
      type="button"
      className={styles.hofCell}
      aria-label={`${index + 1}번 슬롯`}
      aria-current={isCurrent}
      data-slot={index}
      data-kind={entry.kind}
      data-state={entry.state}
      style={{ left: box.x + shake.dx, top: box.y + dy + shake.dy, width: box.width, height: box.height }}
      onClick={() => onPick(index)}
    >
      <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, HALL_OF_FAME_CELL_ART.frame.image)} style={{ left: 0, top: 0 }} />
      {hallOfFameCellImagesOf(index, entry.state, typeIndexOf(entry)).map((image) => {
        const at = hallOfFameCellImageTopLeftOf(image)
        return (
          <img
            key={image.image}
            className={styles.sprite}
            alt=""
            data-cell-image={image.image}
            src={imageSrc(SLT_FRAME, image.image)}
            style={{ left: at.dx, top: at.dy }}
          />
        )
      })}
      {isDimmed && <CellDim />}
    </button>
  )
}

interface HallOfFameGridProps {
  readonly slots: readonly HallOfFameSlotView[]
  readonly view: HallOfFameGridView
  readonly slot: number
  /** 등록 목록의 편 — 다른 편 칸에 덮개를 씌운다. 그 밖은 null */
  readonly edition: HallOfFameSide | null
  readonly shape: GridOpenShape
  readonly gridOpen: GridOpenDraw
  readonly bounce: GridBounceOffset
  readonly onPick: (index: number) => void
}

/** 보이는 칸인가 — 첫 칸부터 행 × 5열 */
const isVisibleSlot = (view: HallOfFameGridView, index: number) =>
  index >= view.firstSlot && index < view.firstSlot + view.rows * HALL_OF_FAME_GRID.columns

/**
 * 5×3 격자 0x7a571 종류 6 — 칸 바탕 없이(시작 넷째 인자 [격자+8] = 0) 칸 틀 · 상태 그림 · (145) 다른 편 덮개 (0x7ac2e).
 * 커서 0x7b3a0 → 0x7b432 — 열림 애니가 끝났고([격자+9]) 깜빡일 때([격자+0x18] % 8 ≤ 4) slt_frame 1 을 (x − 2, y − 2)
 */
export function HallOfFameGrid({ slots, view, slot, edition, shape, gridOpen, bounce, onPick }: HallOfFameGridProps) {
  const isCursorShown = gridOpen.state.isDone && gridOpen.blink % 8 <= 4 && slot >= view.firstSlot
  const cursorCell = hallOfFameCellOf(slot - view.firstSlot, view.firstRowY)
  return (
    <>
      {slots.map((entry, index) =>
        isVisibleSlot(view, index) ? (
          <HallOfFameCell
            key={index}
            index={index}
            entry={entry}
            view={view}
            isCurrent={index === slot}
            shake={index === slot ? bounce : NO_SHAKE}
            dy={gridOpenCellDy(shape, gridOpen.state, index - view.firstSlot)}
            isDimmed={isHallOfFameCellDimmed(edition, index)}
            onPick={onPick}
          />
        ) : null,
      )}
      {isCursorShown && (
        <img
          className={styles.sprite}
          alt=""
          data-testid="명전-커서"
          src={imageSrc(SLT_FRAME, HALL_OF_FAME_CELL_ART.cursor.image)}
          style={{
            left: cursorCell.x + HALL_OF_FAME_CELL_ART.cursor.dx + bounce.dx,
            top: cursorCell.y + HALL_OF_FAME_CELL_ART.cursor.dy + bounce.dy,
          }}
        />
      )}
    </>
  )
}
