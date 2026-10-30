import type { OriginalMission } from '@/shared/config/original/missions'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { GRID, MISSION_GRID_OPEN, cellPositionOf } from '@/pages/mission-select/lib/missionSelectLayout'
import { gridOpenCellDy, type GridOpenDraw } from '@/shared/lib/gridOpen/gridOpen'
import type { GridBounceOffset } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import * as styles from '@/pages/mission-select/ui/MissionSelectScreen.css'

const EMPTY_CELL_COLORS = { background: '#1D2A55', color: '#4A5C8F' } as const

/** 미션 칸의 색 — 잠김 · 클리어 · 열림 */
function missionCellColorsOf(isLocked: boolean, isCleared: boolean) {
  if (isLocked) return EMPTY_CELL_COLORS
  return { background: isCleared ? '#2E4694' : '#213473', color: '#FFFFFF' }
}

/** 칸 글 — 잠김은 비우고, 클리어는 ★, 아니면 칸 번호 */
function missionCellTextOf(isLocked: boolean, isCleared: boolean, index: number) {
  if (isLocked) return ''
  return isCleared ? '★' : index + 1
}

/**
 * 격자 칸 — 원본 미션 고르기 키 0x1dcb0 · 격자 [this+0x70](0x1d9f6 vt+0x1c(5, 3, 1, 0x330))는 키패드로만 커서를 옮긴다.
 * 마우스는 누름(고르기 + OK)만 받는다. 올려 두기만 해도 커서를 옮기던 onMouseEnter 는 걷었다 — 멈춘 포인터가 키 커서를
 * 빼앗는다(메인 메뉴 r27 과 같은 종류). 격자 칸 안쪽 그림은 아직 못 읽어(0x7a571 내부) 번호와 잠김·클리어 상태만 그린다.
 * 커서는 열림 애니가 끝난 뒤([격자+9])에만 그린다(0x7b3a2)
 */
export function MissionGrid({
  missions,
  cursor,
  bounceOffset,
  open,
  clearedKeys,
  isLockedAt,
  onPressCell,
}: {
  readonly missions: readonly OriginalMission[]
  readonly cursor: number
  readonly bounceOffset: GridBounceOffset
  /** 격자 열림 애니 — 아직 안 지었으면 null */
  readonly open: GridOpenDraw | null
  readonly clearedKeys: readonly string[]
  readonly isLockedAt: (index: number) => boolean
  readonly onPressCell: (index: number) => void
}) {
  const cellCount = GRID.columns * GRID.rows
  const cursorCell = cellPositionOf(cursor)
  const openState = open === null ? null : open.state
  return (
    <>
      {Array.from({ length: cellCount }, (_unused, index) => {
        const mission = missions[index]
        const shake = index === cursor ? bounceOffset : null
        const x = cellPositionOf(index).x + (shake?.dx ?? 0)
        const y = cellPositionOf(index).y + (openState === null ? 0 : gridOpenCellDy(MISSION_GRID_OPEN, openState, index)) + (shake?.dy ?? 0)
        const box = { left: x, top: y, width: GRID.cellWidth, height: GRID.cell }
        if (mission === undefined) {
          return <div key={index} className={styles.cell} style={{ ...box, ...EMPTY_CELL_COLORS }} onClick={() => onPressCell(index)} />
        }
        const isLocked = isLockedAt(index)
        const isCleared = clearedKeys.includes(missionKeyOf(mission))
        return (
          <button
            key={index}
            type="button"
            className={styles.cell}
            aria-label={mission.name}
            style={{ ...box, ...missionCellColorsOf(isLocked, isCleared) }}
            onClick={() => onPressCell(index)}
          >
            {missionCellTextOf(isLocked, isCleared, index)}
          </button>
        )
      })}
      {cursor < cellCount && (openState === null || openState.isDone) && (
        <div
          className={styles.cursor}
          style={{ left: cursorCell.x + bounceOffset.dx, top: cursorCell.y + bounceOffset.dy, width: GRID.cellWidth, height: GRID.cell }}
        />
      )}
    </>
  )
}
