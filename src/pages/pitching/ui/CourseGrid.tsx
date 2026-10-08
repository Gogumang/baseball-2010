import * as styles from '@/pages/pitching/ui/CourseGrid.css'

const COURSE_CELL_COUNT = 9

interface CourseGridProps {
  readonly selectedCell: number
  readonly onSelect: (cell: number) => void
}

/** 노릴 코스를 고르는 3×3 격자. */
export function CourseGrid({ selectedCell, onSelect }: CourseGridProps) {
  return (
    <div className={styles.grid}>
      {Array.from({ length: COURSE_CELL_COUNT }, (_unused, cell) => (
        <button
          type="button"
          key={cell}
          className={styles.cell}
          aria-selected={cell === selectedCell}
          onClick={() => onSelect(cell)}
        >
          {cell === selectedCell ? '◎' : '·'}
        </button>
      ))}
    </div>
  )
}
