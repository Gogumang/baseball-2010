import { HALL_OF_FAME_BUBBLE, hallOfFameBubblePositionOf } from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'

type Cell = Parameters<typeof hallOfFameBubblePositionOf>[0]

interface HallOfFameBubbleProps {
  /** 고른 칸 자리 */
  readonly cell: Cell
  readonly cursor: number
  readonly onChoose: (index: number) => void
}

/** 말풍선 (0x65866) — 판 76×36 #2E4694 + 흰 테, 칸 두 개 70×14 #213473 */
export function HallOfFameBubble({ cell, cursor, onChoose }: HallOfFameBubbleProps) {
  const bubble = hallOfFameBubblePositionOf(cell)
  return (
    <div
      className={styles.hofBubble}
      role="menu"
      aria-label="명예의 전당 슬롯"
      style={{
        left: bubble.x,
        top: bubble.y,
        width: HALL_OF_FAME_BUBBLE.width,
        height: HALL_OF_FAME_BUBBLE.height,
        background: HALL_OF_FAME_BUBBLE.panelColor,
        border: `1px solid ${HALL_OF_FAME_BUBBLE.borderColor}`,
        borderRadius: HALL_OF_FAME_BUBBLE.cornerRadius,
      }}
    >
      {HALL_OF_FAME_BUBBLE.labels.map((label, index) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          className={styles.hofBubbleCell}
          aria-current={index === cursor}
          style={{
            left: HALL_OF_FAME_BUBBLE.cell.dx,
            top: cell.y + HALL_OF_FAME_BUBBLE.cell.dys[index] - bubble.y,
            width: HALL_OF_FAME_BUBBLE.cell.width,
            height: HALL_OF_FAME_BUBBLE.cell.height,
            background: HALL_OF_FAME_BUBBLE.cell.color,
            outline: index === cursor ? `1px solid ${HALL_OF_FAME_BUBBLE.selectedBorderColor}` : undefined,
          }}
          onClick={() => onChoose(index)}
        >
          <span className={styles.hofBubbleLabel} style={{ top: HALL_OF_FAME_BUBBLE.labelDy, width: HALL_OF_FAME_BUBBLE.cell.width }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  )
}
