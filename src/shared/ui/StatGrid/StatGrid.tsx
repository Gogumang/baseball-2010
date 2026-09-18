import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/StatGrid/StatGrid.css'

export interface StatEntry {
  readonly label: string
  readonly value: ReactNode
}

interface StatGridProps {
  readonly entries: readonly StatEntry[]
}

/** 타율·안타처럼 이름과 숫자가 짝인 성적을 3열로 늘어놓는다. */
export function StatGrid({ entries }: StatGridProps) {
  return (
    <div className={styles.grid}>
      {entries.map((entry) => (
        <div key={entry.label} className={styles.cell}>
          <span className={styles.label}>{entry.label}</span>
          <span className={styles.value}>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}
