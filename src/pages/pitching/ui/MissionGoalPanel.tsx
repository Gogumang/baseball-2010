import { useEffect, useState } from 'react'
import { goalTickerFrameAt } from '@/entities/mission/model/goalTicker'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { GOAL_TEXT, missionPanelImagesOf } from '@/pages/pitching/lib/missionGoalPanel'
import type { MissionPanelSource } from '@/pages/pitching/lib/missionGoalPanel'
import * as styles from '@/pages/pitching/ui/MissionGoalPanel.css'

interface MissionGoalPanelProps extends MissionPanelSource {
  /** 목표 글 줄 — 레코드 목표 글 +0xe 를 `|` 로 자른 줄 (`goalsOf` 의 이름 차례) */
  readonly goalLines: readonly string[]
  /** 일시정지 팝업이 떠 있으면 장면 그리기가 멈춘다 — 줄 넘김도 멈춘다 */
  readonly isFrozen?: boolean
  /**
   * 0xf 구질 목록이 실린 동안 — 빛 지도(4c5a6, 0x9ce71)가 그 앞까지 그린 화면(HUD 포함)을 RGB 각 × 15/32 로 어둡게 한다.
   * 판은 투수 둘레 원(지름 60) 밖이라 늘 15/32 다
   */
  readonly isDimmed?: boolean
}

/**
 * 미션 HUD 판 0x36714 — 장면(240×320) 오른쪽 위 판에 목표 글 한 줄 · 제한 줄을 그린다 (`lib/missionGoalPanel`).
 * 줄 넘김은 0x36714 의 장면 칸(+0x1808 · +0x17fa · +0x1804 · +0x17fc)대로 `goalTicker` 를 따른다 — 넘기는 동안만 자른다.
 */
export function MissionGoalPanel({ goalLines, isFrozen = false, isDimmed = false, ...source }: MissionGoalPanelProps) {
  const [tick, setTick] = useState(0)
  const lineCount = goalLines.length
  useEffect(() => {
    if (lineCount <= 1 || isFrozen) return
    const timer = window.setInterval(() => setTick((value) => value + 1), millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [lineCount, isFrozen])

  const frame = goalTickerFrameAt(tick, lineCount)
  const isSliding = frame.nextIndex !== null
  const { clip } = GOAL_TEXT
  // 자르는 동안은 자르기 창 안 좌표로 옮겨 그린다
  const originX = isSliding ? clip.x : 0
  const originY = isSliding ? clip.y : 0
  const line = (text: string, shiftX: number) => (
    <span
      className={styles.goalText}
      style={{ left: GOAL_TEXT.x + shiftX - originX, top: GOAL_TEXT.y - originY, width: GOAL_TEXT.width }}
    >
      {text}
    </span>
  )
  const lines = lineCount === 0 ? null : (
    <>
      {line(goalLines[frame.index] ?? '', -frame.offsetX)}
      {frame.nextIndex !== null && line(goalLines[frame.nextIndex] ?? '', 0x4b - frame.offsetX)}
    </>
  )

  return (
    <div className={styles.layer} data-testid="미션 HUD 판" style={isDimmed ? { filter: `brightness(${15 / 32})` } : undefined}>
      {missionPanelImagesOf(source).map((image, index) => (
        <img key={index} className={styles.image} src={image.src} alt="" style={{ left: image.left, top: image.top }} />
      ))}
      {isSliding ? (
        <div className={styles.clip} style={{ left: clip.x, top: clip.y, width: clip.width, height: clip.height }}>
          {lines}
        </div>
      ) : (
        lines
      )}
    </div>
  )
}
