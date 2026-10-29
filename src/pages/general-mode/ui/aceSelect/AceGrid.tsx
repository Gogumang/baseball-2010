import { EffectImage } from '@/shared/ui'
import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/pixelEffect'
import { gridOpenCellDy } from '@/shared/lib/gridOpen/gridOpen'
import type { GridOpenState } from '@/shared/lib/gridOpen/gridOpen'
import type { GridBounceOffset } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { ACE_GRID_OPEN, ACE_LAYOUT, aceCellPositionOf, isAceCellDimmed } from '@/pages/general-mode/lib/prepareLayout'
import { ACE_PHASE } from '@/pages/general-mode/lib/generalModeSetup'
import type { AcePhase } from '@/pages/general-mode/lib/generalModeSetup'
import { acePlayerOfCell } from '@/pages/general-mode/lib/aceSelectCells'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { ACE_ICON, LOCK_LABEL, SLT_IMAGE, imageSrc } from './aceSelectRules'
import type { AceSelectMode } from './aceSelectRules'

const CELL_COUNT = ACE_LAYOUT.grid.columns * ACE_LAYOUT.grid.rows
const CELLS = Array.from({ length: CELL_COUNT }, (_unused, cell) => cell)

/** 칸 자리 — 열림 애니(0x79fa8)의 칸 내림과, 커서 칸이면 튕김을 더한다 */
function cellPointOf(cell: number, cursor: number, openState: GridOpenState, bounceOffset: GridBounceOffset) {
  const shake = cell === cursor ? bounceOffset : null
  const x = aceCellPositionOf(cell).x + (shake?.dx ?? 0)
  const y = aceCellPositionOf(cell).y + gridOpenCellDy(ACE_GRID_OPEN, openState, cell) + (shake?.dy ?? 0)
  return { x, y }
}

/**
 * 10칸 격자 0x7a571 종류 7 — 칸마다 남색 둥근 바탕(x − 3, y − 3, 43×43) · slt_frame 이미지 0 · 얼굴(x + 3, y + 2) 또는 "?"(x + 10, y + 5),
 * 커서는 깜빡일 때 slt_frame 이미지 1 을 (x − 2, y − 2) (prepareLayout `ACE_LAYOUT.cellBack` 머리말)
 */
export function AceGrid({
  mode,
  phase,
  cursor,
  chosenPitcherCell,
  openState,
  bounceOffset,
  isGridCursorOn,
  isCellOpen,
  isCellReachable,
  onTapCell,
}: {
  readonly mode: AceSelectMode
  readonly phase: AcePhase
  readonly cursor: number
  readonly chosenPitcherCell: number | null
  readonly openState: GridOpenState
  readonly bounceOffset: GridBounceOffset
  readonly isGridCursorOn: boolean
  readonly isCellOpen: (cell: number) => boolean
  readonly isCellReachable: (cell: number) => boolean
  readonly onTapCell: (cell: number) => void
}) {
  const back = ACE_LAYOUT.cellBack
  return (
    <>
      {CELLS.map((cell) => {
        const { x, y } = cellPointOf(cell, cursor, openState, bounceOffset)
        return (
          <span key={`back-${cell}`}>
            {/* 0x6b7d5(…, 43, 43, 둥글기 1) — (w + 1)×(h + 1) 에서 네 모서리 점이 빠진 꼴 */}
            <span
              className={styles.fillPanel}
              style={{ left: x + back.dx + 1, top: y + back.dy, width: back.size - 1, height: back.size + 1, background: back.color }}
            />
            <span
              className={styles.fillPanel}
              style={{ left: x + back.dx, top: y + back.dy + 1, width: back.size + 1, height: back.size - 1, background: back.color }}
            />
          </span>
        )
      })}
      {CELLS.map((cell) => {
        const { x, y } = cellPointOf(cell, cursor, openState, bounceOffset)
        const player = acePlayerOfCell(cell)
        const open = isCellOpen(cell)
        // [skin+0x105] 가 서 있으면 흐리지 않는다(0x7b17a) — 레벨업 화면, 그리고 코치채용: 시즌 0xd7 진입 0x5268 이
        // this+0x11c == 2(코치채용)면 [skin+0x105] = 1 로 둔다(0x52ac~0x52ba, [this+0xa8] = [0x1552cfc] 는 생성자 0x3b3c~0x3b4c) — 확정
        const isDimmed = mode === '고르기' && isAceCellDimmed(cell, phase === ACE_PHASE.마투수, chosenPitcherCell)
        return (
          <button
            key={cell}
            type="button"
            aria-label={open && player !== undefined ? player.name : LOCK_LABEL}
            aria-pressed={cell === cursor}
            disabled={!isCellReachable(cell)}
            className={styles.cell}
            data-dimmed={isDimmed}
            style={{ left: x, top: y, width: ACE_LAYOUT.grid.cell, height: ACE_LAYOUT.grid.cell }}
            // 원본 격자(상태 21 진입 0x263f4 · 28 진입 0x262c8 의 vt+0x1c)는 키패드로만 커서를 옮긴다 — 올려 두기로 커서를 옮기던 onMouseEnter 는 걷었다(멈춘
            // 포인터가 키 커서를 빼앗는다, 메인 메뉴 r27 과 같은 종류). 누름만 남긴다 — 첫 누름은 커서, 커서 칸 누름은 OK (`tapCell`)
            onClick={() => onTapCell(cell)}
          >
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, ACE_LAYOUT.cellImage)} style={{ left: 0, top: 0 }} />
            {open && player !== undefined ? (
              <EffectImage
                className={styles.layer}
                src={player.iconUrl}
                effect={isDimmed ? DRAW_EFFECT.GRAY : null}
                style={{ left: ACE_LAYOUT.icon.dx, top: ACE_LAYOUT.icon.dy }}
              />
            ) : (
              <img
                className={styles.layer}
                alt=""
                src={imageSrc(ACE_ICON, ACE_LAYOUT.lockedIcon.image)}
                style={{ left: ACE_LAYOUT.lockedIcon.dx, top: ACE_LAYOUT.lockedIcon.dy }}
              />
            )}
          </button>
        )
      })}
      {isGridCursorOn && (
        <img
          className={styles.layer}
          alt=""
          data-testid="마선수-커서"
          src={imageSrc(SLT_IMAGE, ACE_LAYOUT.cursor.image)}
          style={{
            left: aceCellPositionOf(cursor).x + ACE_LAYOUT.cursor.dx + bounceOffset.dx,
            top: aceCellPositionOf(cursor).y + ACE_LAYOUT.cursor.dy + bounceOffset.dy,
          }}
        />
      )}
    </>
  )
}
