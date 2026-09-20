import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { gaugeGradeOf } from '@/entities/pitcher-career/model/pitchGauge'
import {
  GAUGE_OUTER_FRAME,
  gaugeFrameForCell,
} from '@/pages/pitching/lib/pitchGaugeSprite'
import * as styles from '@/pages/pitching/ui/PitchGradeGauge.css'

interface PitchGradeGaugeProps {
  /** 칸을 눌렀다 — 0 이면 안 누른 것이다 */
  readonly onPress: (cell: number) => void
}

/**
 * 원본 투구 게이지 (경기 상태 0x11 의 그리기 0x4d2ac, 누름 0x50e08 — P1 4-1 · S5 U-15).
 *
 * 커서 칸 `scene+0x17bc` 는 그리기 함수가 **틱마다 +1** 한다. 칸 8 을 넘으면 커서 그림이 사라지고,
 * 그 뒤에 눌러야 가장 좋은 등급 t=5(칸 9)가 나온다.
 *
 * ⚠️ **원본 그대로**: 칸 8 과 9 는 프레임을 `min(…, 0x43)` 으로 자르는 바람에 **화면에서 구별되지 않고**,
 * 칸 9 는 원이 사라진 바로 그 한 틱이다. 편하라고 글자·표시를 덧붙이지 않는다.
 *
 * 칸을 안 누르고 지나가면 등급 0 으로 던진다 — 부르는 쪽이 `onPress(0)` 을 받는다.
 */
export function PitchGradeGauge({ onPress }: PitchGradeGaugeProps) {
  const [cell, setCell] = useState(0)
  const cellRef = useRef(0)

  useEffect(() => {
    const tick = window.setInterval(() => {
      // 한 칸 = 한 틱 (기본 속도 16fps ≈ 62ms)
      cellRef.current += 1
      setCell(cellRef.current)
    }, millisecondsPerFrame())
    return () => window.clearInterval(tick)
  }, [])

  const cursor = gaugeFrameForCell(cell)
  // 게이지 칸이 1~9 가 아니면 원본이 그냥 무시한다 (0x50e1e)
  const grade = gaugeGradeOf(cell)

  return (
    <button
      type="button"
      className={styles.gauge}
      onClick={() => onPress(cell)}
      aria-label={`투구 게이지 ${cell}칸`}
    >
      <span
        className={styles.circle}
        style={{
          width: `${GAUGE_OUTER_FRAME.size}px`,
          height: `${GAUGE_OUTER_FRAME.size}px`,
          background: GAUGE_OUTER_FRAME.color ?? undefined,
        }}
      />
      {cursor !== null && cursor.color !== null && (
        <span
          className={styles.circle}
          style={{
            width: `${cursor.size}px`,
            height: `${cursor.size}px`,
            background: cursor.color,
          }}
        />
      )}
      {cursor !== null && cursor.color === null && (
        <span
          className={`${styles.circle} ${styles.outline}`}
          style={{ width: `${cursor.size}px`, height: `${cursor.size}px` }}
        />
      )}
      <span className={styles.hint}>누르면 던집니다 (지금 등급 {grade})</span>
    </button>
  )
}
