import { FrameSprite } from '@/shared/ui'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats'
import { RECORD_COUNT_KINDS, achievementMarkOf, recordCountOf } from '@/entities/collection/model/annalsStats'
import {
  ACHIEVEMENT_MARK,
  LIST_GRID,
  LIST_NAME,
  LIST_ROW_FRAME_DY,
  RECORD_COUNT,
  SPECIAL_RECORD_FIRST_CELL,
  STAT_NAME,
  STAT_VALUE,
  listFirstYOf,
  listRowFrameOf,
} from '@/pages/record/lib/recordAnnalsLayout'
import { STAT_NAMES } from '@/pages/record/lib/statNames'
import { statNameOffsetOf, statPageCellsOf, statValueTextOf } from '@/pages/record/lib/statCells'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { SLT_FRAME, SLT_FRAMES, imageSrc } from '@/pages/record/ui/recordAnnals/annalsAssets'
import type { Origins } from '@/pages/record/ui/recordAnnals/annalsAssets'

/** 탭 0·4 칸 바탕 — slt_frame 프레임 10 · 11(탭 0 쪽 5) · 13(탭 4) 을 (칸 x − 1, 칸 y − 1) 에 (0x7a916 · 0x7a9cc) */
export function ListRowFrames({ frames, tab, page }: { readonly frames: Origins; readonly tab: number; readonly page: number }) {
  return (
    <>
      {Array.from({ length: LIST_GRID.rows }, (_, row) => (
        <FrameSprite
          key={row}
          folder={SLT_FRAMES}
          frame={listRowFrameOf(tab, page)}
          origins={frames}
          x={LIST_GRID.x}
          y={listFirstYOf(tab) + LIST_GRID.step * row + LIST_ROW_FRAME_DY}
        />
      ))}
    </>
  )
}

/** 기록·통계 탭의 1열 8줄 목록 */
export function ListRows({ page, names }: { readonly page: number; readonly names: readonly string[] }) {
  const start = page * LIST_GRID.rows
  return (
    <>
      {names.slice(start, start + LIST_GRID.rows).map((name, offset) => (
        <div
          key={name}
          className={styles.rowText}
          style={{ left: LIST_GRID.cellX + LIST_NAME.dx, top: LIST_GRID.firstY + LIST_GRID.step * offset + LIST_NAME.dy }}
        >
          {name}
        </div>
      ))}
    </>
  )
}

/** 탭 0 셀 0~39 의 달성 횟수 `"!R!cffff00%d"` — 0 도 찍는다 (0x7a0d0~0x7a0fc) */
export function RecordCounts({ page, stats }: { readonly page: number; readonly stats: AnnalsStats }) {
  return (
    <>
      {Array.from({ length: LIST_GRID.rows }, (_, row) => {
        const cell = page * LIST_GRID.rows + row
        if (cell >= RECORD_COUNT_KINDS) return null
        return (
          <div
            key={cell}
            className={styles.statValue}
            data-cell={cell}
            style={{
              left: LIST_GRID.cellX + RECORD_COUNT.dx,
              top: LIST_GRID.firstY + LIST_GRID.step * row + RECORD_COUNT.dy,
              width: LIST_GRID.cellWidth - RECORD_COUNT.widthInset,
            }}
          >
            {recordCountOf(stats, cell)}
          </div>
        )
      })}
    </>
  )
}

/** 탭 0 셀 40~47 의 달성 표시 — slt_frame 이미지 71 을 칸 오른쪽 끝에 (0x7a102~0x7a156) */
export function AchievementMarks({ page, stats }: { readonly page: number; readonly stats: AnnalsStats }) {
  return (
    <>
      {Array.from({ length: LIST_GRID.rows }, (_, row) => {
        const cell = page * LIST_GRID.rows + row
        if (cell < SPECIAL_RECORD_FIRST_CELL || achievementMarkOf(stats, cell - SPECIAL_RECORD_FIRST_CELL) === 0) return null
        return (
          <img
            key={cell}
            className={styles.sprite}
            alt="달성"
            data-cell={cell}
            src={imageSrc(SLT_FRAME, ACHIEVEMENT_MARK.image)}
            style={{
              left: LIST_GRID.cellX + LIST_GRID.cellWidth - ACHIEVEMENT_MARK.width + ACHIEVEMENT_MARK.dx,
              top: LIST_GRID.firstY + LIST_GRID.step * row + ACHIEVEMENT_MARK.dy,
            }}
          />
        )
      })}
    </>
  )
}

/** 통계 탭의 1열 8줄 — 칸 번호 = 쪽 × 8 + 줄, 빈 번호는 아무것도 안 그린다 (0x7a08c) */
export function StatRows({ page, stats }: { readonly page: number; readonly stats: AnnalsStats }) {
  return (
    <>
      {statPageCellsOf(page).map((cell, row) => {
        if (cell === null) return null
        const top = listFirstYOf(4) + LIST_GRID.step * row
        const value = cell.valueOf(stats)
        return (
          <div key={cell.nameIndex}>
            <div
              className={styles.rowText}
              style={{ left: LIST_GRID.cellX + STAT_NAME.dx, top: top + STAT_NAME.dy, width: LIST_GRID.cellWidth - STAT_NAME.widthInset }}
            >
              {STAT_NAMES[statNameOffsetOf(cell)]}
            </div>
            <div
              className={styles.statValue}
              style={{ left: LIST_GRID.cellX + STAT_VALUE.dx, top: top + STAT_VALUE.dy, width: LIST_GRID.cellWidth - STAT_VALUE.widthInset }}
            >
              {statValueTextOf(cell.valueKind, value)}
            </div>
          </div>
        )
      })}
    </>
  )
}
