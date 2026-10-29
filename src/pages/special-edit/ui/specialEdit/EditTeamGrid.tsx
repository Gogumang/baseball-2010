import { TEAMS } from '@/shared/config/original/teams'
import { gridOpenCellDy } from '@/shared/lib/gridOpen/gridOpen'
import type { GridOpenDraw, GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'
import type { GridBounceOffset } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { EDIT_TEAM_COUNT } from '@/pages/special-edit/lib/specialEditFlow'
import * as styles from '@/pages/special-edit/ui/SpecialEditScreen.css'
import { GRID, GridCellBack, cellPositionOf } from '@/pages/special-edit/ui/specialEdit/otherSlices'
import {
  CELL_CURSOR_IMAGE,
  CELL_CURSOR_SIZE,
  CELL_FRAME_IMAGE,
  CELL_LOGO_SIZE,
  SLT_IMAGE,
  imageSrc,
} from '@/pages/special-edit/ui/specialEdit/editAssets'

const EDIT_TEAMS = TEAMS.slice(0, EDIT_TEAM_COUNT)
const NO_SHAKE = { dx: 0, dy: 0 }

interface EditTeamGridProps {
  readonly cursor: number
  readonly shape: GridOpenShape
  readonly gridOpen: GridOpenDraw
  readonly bounce: GridBounceOffset
  readonly onPress: (index: number) => void
}

/** 칸 자리 — 열림 애니 미끄럼 · 고른 칸 튕김을 더한다 */
function cellAt(index: number, { cursor, shape, gridOpen, bounce }: EditTeamGridProps) {
  const shake = index === cursor ? bounce : NO_SHAKE
  const base = cellPositionOf(index, EDIT_TEAM_COUNT)
  return { x: base.x + shake.dx, y: base.y + gridOpenCellDy(shape, gridOpen.state, index) + shake.dy }
}

/** 격자 10칸 — 칸 바탕(시작 0x7a005(격자, [skin+0xe8], 1, 1) 의 [격자+8] = 1, 0x7a7da~0x7a89c) 뒤 칸 틀 · 로고 · 커서 */
export function EditTeamGrid(props: EditTeamGridProps) {
  const { cursor, gridOpen, onPress } = props
  return (
    <>
      {EDIT_TEAMS.map((entry, index) => {
        const at = cellAt(index, props)
        return <GridCellBack key={`back-${entry.id}`} className={styles.layer} x={at.x} y={at.y} width={GRID.cell} height={GRID.cell} />
      })}
      {EDIT_TEAMS.map((entry, index) => {
        const at = cellAt(index, props)
        return (
          <button
            key={entry.id}
            type="button"
            aria-label={entry.name}
            aria-pressed={index === cursor}
            className={styles.cell}
            style={{ left: at.x, top: at.y, width: GRID.cell, height: GRID.cell }}
            onClick={() => onPress(index)}
          >
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_FRAME_IMAGE)} style={{ left: 0, top: 0 }} />
            <img
              className={styles.layer}
              alt=""
              src={entry.logoUrl}
              style={{ left: (GRID.cell - CELL_LOGO_SIZE) / 2, top: (GRID.cell - CELL_LOGO_SIZE) / 2, width: CELL_LOGO_SIZE, height: CELL_LOGO_SIZE }}
            />
            {index === cursor && gridOpen.state.isDone && (
              <img
                className={styles.layer}
                alt=""
                src={imageSrc(SLT_IMAGE, CELL_CURSOR_IMAGE)}
                style={{ left: (GRID.cell - CELL_CURSOR_SIZE) / 2, top: (GRID.cell - CELL_CURSOR_SIZE) / 2 }}
              />
            )}
          </button>
        )
      })}
    </>
  )
}
