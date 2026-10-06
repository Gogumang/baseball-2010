import { useEffect, useState } from 'react'
import type { goalsOf } from '@/entities/mission/model/missionGoal'
import { GOAL_TICKER_SHIFT_X, GOAL_TICKER_SHIFT_Y, goalTickerFrameAt } from '@/entities/mission/model/goalTicker'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import * as styles from '@/entities/mission/ui/GoalBar.css'

interface GoalBarProps {
  /** 목표 글 줄 — `goalsOf` 의 이름 차례가 레코드 목표 글 +0xe 를 `|` 로 자른 줄 그대로다 */
  readonly goals: ReturnType<typeof goalsOf>
}

/**
 * 미션 목표 띠. 타자편·투수편 화면이 같이 쓴다.
 *
 * 원본 0x36714 는 목표 글 +0xe 의 줄을 **하나씩** 보이며 넘길 뿐, 개수·진행 수·달성 표시는 그리지 않는다
 * (`goalTicker` 주석). 그래서 이름만 보이고 갱신 한 틱(`millisecondsPerFrame`)마다 띠를 한 칸 넘긴다.
 */
export function GoalBar({ goals }: GoalBarProps) {
  const [tick, setTick] = useState(0)
  const lineCount = goals.length
  useEffect(() => {
    if (lineCount <= 1) return
    const timer = window.setInterval(() => setTick((value) => value + 1), millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [lineCount])

  if (lineCount === 0) return <div className={styles.bar} />
  const frame = goalTickerFrameAt(tick, lineCount)
  return (
    <div className={styles.bar}>
      <span
        className={styles.goal}
        style={{ transform: `translate(${-frame.offsetX}px, ${-frame.offsetY}px)` }}
      >
        {goals[frame.index].name}
      </span>
      {frame.nextIndex !== null && (
        <span
          className={styles.goal}
          style={{
            transform: `translate(${GOAL_TICKER_SHIFT_X - frame.offsetX}px, ${GOAL_TICKER_SHIFT_Y - frame.offsetY}px)`,
          }}
        >
          {goals[frame.nextIndex].name}
        </span>
      )}
    </div>
  )
}
