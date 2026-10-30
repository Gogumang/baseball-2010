import { HELP_RATING_TABLE } from '@/pages/help/lib/helpPages'
import * as styles from '@/pages/help/ui/HelpScreen.css'

/** 게임물 등급표 — 장 6 둘째 쪽(빈 StrHOWTO[33]) 자리 (0x54330, `HELP_RATING_TABLE`) */
export function RatingTable() {
  const table = HELP_RATING_TABLE
  return (
    <div
      className={styles.ratingTable}
      data-testid="등급표"
      style={{ left: table.x, top: table.y, width: table.width + 1, height: table.height + 1, background: table.fill }}
    >
      <div className={styles.ratingLine} style={{ left: table.dividerX, top: 0, width: 1, height: table.height }} />
      {table.rows.map(([label, value], row) => (
        <div key={label}>
          <span className={styles.ratingText} style={{ left: table.labelX, top: row * table.rowHeight + table.textDy, color: table.text }}>
            {label}
          </span>
          <span className={styles.ratingText} style={{ left: table.valueX, top: row * table.rowHeight + table.textDy, color: table.text }}>
            {value}
          </span>
          <div className={styles.ratingLine} style={{ left: 0, top: (row + 1) * table.rowHeight, width: table.width, height: 1 }} />
        </div>
      ))}
    </div>
  )
}
