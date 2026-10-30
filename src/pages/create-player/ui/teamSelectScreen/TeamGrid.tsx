import { OriginalScaledImage } from '@/shared/ui'
import { TEAMS, type TeamRecord } from '@/shared/config/original/teams'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { blackStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import { gridOpenCellDy, type GridOpenState } from '@/shared/lib/gridOpen/gridOpen'
import type { GridBounceOffset } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { GRID, LOCKED_NAME, TEAM_COUNT, cellPositionOf, isTeamOpen } from '@/pages/create-player/lib/teamSelectLayout'
import * as styles from '@/pages/create-player/ui/TeamSelectScreen.css'
import { GridCellBack } from '@/pages/create-player/ui/GridCellBack'
import {
  CELL_COVER_SIZE,
  CELL_CURSOR_IMAGE,
  CELL_CURSOR_SIZE,
  CELL_FRAME_IMAGE,
  CELL_LOCKED_MARK,
  CELL_LOGO,
  SLT_IMAGE,
  TEAM_COVER_STEP,
  TEAM_GRID_OPEN,
  TEAM_LOGO_IMAGE,
  imageSrc,
} from './teamSelectAssets'

/** 칸 자리 — 열림 애니의 줄 내림 · 고른 칸의 튕김을 더한다 */
function cellPointOf(index: number, openState: GridOpenState, shake: GridBounceOffset | null) {
  return {
    x: cellPositionOf(index).x + (shake?.dx ?? 0),
    y: cellPositionOf(index).y + gridOpenCellDy(TEAM_GRID_OPEN, openState, index) + (shake?.dy ?? 0),
  }
}

/** 칸 안 로고 — 열린 팀은 줄인 로고(0x66431), 잠긴 히든 칸은 "?" 절반 크기(0xbb91d) */
function CellMark({ team, isOpen }: { readonly team: TeamRecord; readonly isOpen: boolean }) {
  if (isOpen) {
    // 0x66431 — 0x663c4 가 원본 식(0x662dc → 0x65f64)으로 미리 줄인 35×34 버퍼를 칸 + (2, 2) 에 제 크기로
    return (
      <OriginalScaledImage
        className={styles.layer}
        alt=""
        src={team.logoUrl}
        boxWidth={CELL_LOGO.width}
        boxHeight={CELL_LOGO.height}
        style={{ left: CELL_LOGO.x, top: CELL_LOGO.y }}
      />
    )
  }
  return (
    <img
      className={styles.layer}
      alt="?"
      data-testid="팀칸-물음표"
      src={imageSrc(TEAM_LOGO_IMAGE, CELL_LOCKED_MARK.image)}
      style={{ left: CELL_LOCKED_MARK.x, top: CELL_LOCKED_MARK.y, width: CELL_LOCKED_MARK.width, height: CELL_LOCKED_MARK.height }}
    />
  )
}

/**
 * 15팀 격자 — 시작 0x7a005(격자, [skin+0xe8], 1, 1) 의 넷째 인자 [격자+8] = 1 이라 칸 바탕(남색 둥근 네모)을 모든 칸에 먼저 깔고,
 * 칸마다 바탕(slt_frame 0) · 로고 또는 물음표 · 덮기 칸(`coveredTeamId`) · 커서(열림 애니가 끝난 뒤 [격자+9] 에만 0x7b3a0)를 얹는다
 */
export function TeamGrid({
  cursor,
  bounceOffset,
  openState,
  openedHiddenIds,
  coveredTeamId = -1,
  onPressCell,
}: {
  readonly cursor: number
  readonly bounceOffset: GridBounceOffset
  readonly openState: GridOpenState
  readonly openedHiddenIds: readonly number[]
  /** 어둡게 덮는 칸 — 안 주면 −1(덮지 않는다) */
  readonly coveredTeamId: number | undefined
  readonly onPressCell: (index: number) => void
}) {
  const teams = TEAMS.slice(0, TEAM_COUNT)
  return (
    <>
      {teams.map((entry, index) => {
        const point = cellPointOf(index, openState, index === cursor ? bounceOffset : null)
        return <GridCellBack key={`back-${entry.id}`} className={styles.layer} x={point.x} y={point.y} width={GRID.cell} height={GRID.cell} />
      })}
      {teams.map((entry, index) => {
        const point = cellPointOf(index, openState, index === cursor ? bounceOffset : null)
        const open = isTeamOpen(index, openedHiddenIds)
        return (
          <button
            key={entry.id}
            type="button"
            aria-label={open ? entry.name : LOCKED_NAME}
            aria-pressed={index === cursor}
            className={styles.cell}
            style={{ left: point.x, top: point.y, width: GRID.cell, height: GRID.cell }}
            onClick={() => onPressCell(index)}
          >
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_FRAME_IMAGE)} style={{ left: 0, top: 0 }} />
            <CellMark team={entry} isOpen={open} />
            {open && index === coveredTeamId && (
              <span
                className={styles.layer}
                data-testid="팀칸-덮기"
                style={{
                  left: 0,
                  top: 0,
                  width: CELL_COVER_SIZE.width,
                  height: CELL_COVER_SIZE.height,
                  background: ORIGINAL_COLORS.black,
                  opacity: blackStepCoverOpacityOf(TEAM_COVER_STEP),
                }}
              />
            )}
            {index === cursor && openState.isDone && (
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
