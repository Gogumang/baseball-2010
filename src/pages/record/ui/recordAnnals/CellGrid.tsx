import { FrameSprite } from '@/shared/ui'
import { CELL_FRAMES, CELL_GRID, LOCKED_MARK, SCROLL_MARKS, cellPositionOf } from '@/pages/record/lib/recordAnnalsLayout'
import { VISIBLE_GRID_ROWS } from '@/pages/record/lib/annalsGrid'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { SLT_FRAME, SLT_FRAMES, imageSrc } from '@/pages/record/ui/recordAnnals/annalsAssets'
import type { Origins } from '@/pages/record/ui/recordAnnals/annalsAssets'

export interface CellItem {
  readonly name: string
  readonly isGained: boolean
  /** 얻은 칸 프레임 — 없으면 격자 공통 값 (진행 탭은 칸마다 다르다, `endingCellFrameOf`) */
  readonly gainedFrame?: number
}

const NO_SHIFT = { dx: 0, dy: 0 }

/** 칸 그림 — 얻은 칸은 칸마다 값(없으면 격자 공통), 못 얻은 칸은 잠김 */
const cellFrameOf = (item: CellItem, gainedFrame: number) => (item.isGained ? (item.gainedFrame ?? gainedFrame) : CELL_FRAMES.locked)

/** 칸 글 — 얻은 칸은 그림자 + 이름, 못 얻은 칸은 자물쇠 표시 */
function CellLabel({ item, x, y }: { readonly item: CellItem; readonly x: number; readonly y: number }) {
  if (!item.isGained) {
    return LOCKED_MARK.dx.map((dx) => (
      <img key={dx} className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, LOCKED_MARK.image)} style={{ left: x + dx, top: y + LOCKED_MARK.dy }} />
    ))
  }
  return (
    <>
      <div className={styles.cellShadow} style={{ left: x, top: y + 7, width: CELL_GRID.width }}>
        {item.name}
      </div>
      <div className={styles.cellName} style={{ left: x - 1, top: y + 6, width: CELL_GRID.width }}>
        {item.name}
      </div>
    </>
  )
}

/**
 * 41×25 칸 격자 4열 (탭 1 진행 · 탭 2 스킬). 칸 번호 `윗줄 × 4` ~ `(윗줄 + 3) × 4 − 1` 을 그린다(0x2ebcc~0x2ebe0) —
 * 보이는 i 번째 칸 = 번호 − 윗줄 × 4.
 */
export function CellGrid({
  frames,
  items,
  gainedFrame,
  cursor,
  top,
  hasDownMark: isDownMarkShown,
  isCursorShown,
  isBlinking,
  cursorShake,
  onSelect,
}: {
  readonly frames: Origins
  readonly items: readonly CellItem[]
  readonly gainedFrame: number
  readonly cursor: number
  readonly top: number
  readonly hasDownMark: boolean
  readonly isCursorShown: boolean
  readonly isBlinking: boolean
  /** 고른 칸만 이만큼 옮겨 그린다 — 칸·이름·테두리 모두 (0x2ec52 가 x·y 자체를 바꾼다) */
  readonly cursorShake: { readonly dx: number; readonly dy: number } | null
  readonly onSelect: (index: number) => void
}) {
  const visible = CELL_GRID.columns * VISIBLE_GRID_ROWS
  const start = top * CELL_GRID.columns

  return (
    <>
      {items.slice(start, start + visible).map((item, offset) => {
        const index = start + offset
        const base = cellPositionOf(offset)
        const shift = index === cursor ? (cursorShake ?? NO_SHIFT) : NO_SHIFT
        const x = base.x + shift.dx
        const y = base.y + shift.dy
        return (
          <div key={item.name + index}>
            <FrameSprite folder={SLT_FRAMES} frame={cellFrameOf(item, gainedFrame)} origins={frames} x={x} y={y} />
            <CellLabel item={item} x={x} y={y} />
            {index === cursor && isCursorShown && <FrameSprite folder={SLT_FRAMES} frame={CELL_FRAMES.cursor} origins={frames} x={x - 1} y={y - 1} />}
            <button
              type="button"
              className={styles.cell}
              aria-label={item.isGained ? item.name : '???'}
              style={{ left: x, top: y, width: CELL_GRID.width, height: CELL_GRID.height }}
              onClick={() => onSelect(index)}
            />
          </div>
        )
      })}
      {top > 0 && (
        <FrameSprite
          folder={SLT_FRAMES}
          frame={SCROLL_MARKS.up.frame}
          origins={frames}
          x={SCROLL_MARKS.x}
          y={isBlinking ? SCROLL_MARKS.up.yOn : SCROLL_MARKS.up.yOff}
        />
      )}
      {isDownMarkShown && (
        <FrameSprite
          folder={SLT_FRAMES}
          frame={SCROLL_MARKS.down.frame}
          origins={frames}
          x={SCROLL_MARKS.x}
          y={isBlinking ? SCROLL_MARKS.down.yOn : SCROLL_MARKS.down.yOff}
        />
      )}
    </>
  )
}
