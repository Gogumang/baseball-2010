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
 * 미션 목표 띠 — 지금은 투수편 화면(pages/pitching)만 쓴다.
 *
 * ⚠️ 근사: 원본 0x36714 는 웹 껍데기 띠가 아니라 타석 캔버스 오른쪽 위 trainning.pzx 판에 목표 글 한 줄과 노란 "지금/목표"
 * (0x36358)를 그린다. 타자 미션은 원본대로 옮겼다(`pages/mission-play/ui/MissionHud` · `missionHudLayout`) — 투수편(모드 5:
 * 공 그림 7 · "투구" 띠 · 표 0xcfdf4/0xcfe48)은 투수편 화면을 옮길 때 같이 바꾼다.
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
