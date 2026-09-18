import type { goalsOf } from '@/entities/mission/model/missionGoal'
import * as styles from '@/entities/mission/ui/GoalBar.css'

interface GoalBarProps {
  readonly goals: ReturnType<typeof goalsOf>
}

/** 미션 목표 달성 현황. 타자편·투수편 화면이 같이 쓴다. */
export function GoalBar({ goals }: GoalBarProps) {
  return (
    <div className={styles.bar}>
      {goals.map((entry) => (
        <span
          key={entry.name}
          className={
            entry.achieved >= entry.required ? `${styles.goal} ${styles.achieved}` : styles.goal
          }
        >
          {entry.name} {entry.achieved}/{entry.required}
        </span>
      ))}
    </div>
  )
}
