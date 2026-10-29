import { FrameSprite } from '@/shared/ui'
import type { Collection } from '@/entities/collection/model/collection'
import {
  CELL_FRAMES,
  ENDING_CELL_NAMES,
  NARI_ENDING_CELL_COUNT,
  PROGRESS_ROW,
  endingCellFrameOf,
  endingProgressOf,
} from '@/pages/record/lib/recordAnnalsLayout'
import { hasDownMark } from '@/pages/record/lib/annalsGrid'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { IMG_TEXT, SLT_FRAME, SLT_FRAMES, imageSrc, nameWidthOf } from '@/pages/record/ui/recordAnnals/annalsAssets'
import type { Origins } from '@/pages/record/ui/recordAnnals/annalsAssets'
import { CellGrid } from '@/pages/record/ui/recordAnnals/CellGrid'
import type { CellItem } from '@/pages/record/ui/recordAnnals/CellGrid'
import type { RecordAnnalsState } from '@/pages/record/ui/recordAnnals/useRecordAnnals'

/** 진행 탭 칸 20 — 0~14 나리 엔딩(전역기록 +0xa8 + i) · 15~19 시즌 엔딩(+0xa0 + j) (0x58b5c) */
function endingCellsOf(collection: Collection): readonly CellItem[] {
  return ENDING_CELL_NAMES.map((name, index) => ({
    name,
    isGained: index < NARI_ENDING_CELL_COUNT ? collection.endings.includes(index) : collection.seasonEndings.includes(index - NARI_ENDING_CELL_COUNT),
    gainedFrame: endingCellFrameOf(index),
  }))
}

/** 모드 줄 하나 — 점 · 모드 이름 · "진행률" · 틀 · 백분율 (줄 0 나리 · 1 시즌) */
function ProgressRow({
  row,
  modeFrame,
  gained,
  textFrames,
  frames,
}: {
  readonly row: number
  readonly modeFrame: number
  readonly gained: number
  readonly textFrames: Origins
  readonly frames: Origins
}) {
  const y = PROGRESS_ROW.firstY + PROGRESS_ROW.step * row
  return (
    <div>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, PROGRESS_ROW.bulletImage)}
        style={{ left: PROGRESS_ROW.bulletX, top: y + PROGRESS_ROW.bulletDy }}
      />
      <FrameSprite folder={IMG_TEXT} frame={modeFrame} origins={textFrames} x={PROGRESS_ROW.modeLabelX} y={y} />
      <FrameSprite
        folder={IMG_TEXT}
        frame={PROGRESS_ROW.labelFrame}
        origins={textFrames}
        x={PROGRESS_ROW.modeLabelX + nameWidthOf(textFrames, modeFrame) + PROGRESS_ROW.labelGap}
        y={y}
      />
      <FrameSprite folder={SLT_FRAMES} frame={PROGRESS_ROW.frame} origins={frames} x={PROGRESS_ROW.frameX} y={y + PROGRESS_ROW.frameDy} />
      <div className={styles.progressValue} style={{ left: PROGRESS_ROW.frameX, top: y, width: PROGRESS_ROW.frameWidth }}>
        {endingProgressOf(row, gained)}%
      </div>
    </div>
  )
}

/** 탭 1 진행 — 엔딩 칸 격자 · 모드 줄 둘 */
export function ProgressTabBody({ state, collection }: { readonly state: RecordAnnalsState; readonly collection: Collection }) {
  const { frames, textFrames, cursor, gridTop, isTabFocused, isBlinking, cursorShake, selectCell } = state
  const endingCells = endingCellsOf(collection)
  return (
    <>
      <CellGrid
        frames={frames}
        gainedFrame={CELL_FRAMES.progress}
        cursor={cursor}
        top={gridTop}
        hasDownMark={hasDownMark(1, gridTop)}
        isCursorShown={!isTabFocused && isBlinking}
        isBlinking={isBlinking}
        cursorShake={cursorShake}
        onSelect={selectCell}
        items={endingCells}
      />
      {PROGRESS_ROW.modeFrames.map((modeFrame, row) => (
        <ProgressRow
          key={modeFrame}
          row={row}
          modeFrame={modeFrame}
          gained={endingCells.filter((cell, index) => cell.isGained && (row === 0) === index < NARI_ENDING_CELL_COUNT).length}
          textFrames={textFrames}
          frames={frames}
        />
      ))}
    </>
  )
}
