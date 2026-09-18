import { useEffect, useRef, useState } from 'react'
import { judgeGauge } from '@/entities/pitching/model/pitchCommand'
import type { GaugeResult } from '@/entities/pitching/model/pitchCommand'
import * as styles from '@/pages/pitching/ui/PitchGauge.css'

/** 게이지가 한 번 왕복하는 시간 */
const GAUGE_CYCLE_MILLISECONDS = 900

interface PitchGaugeProps {
  readonly onThrow: (gauge: GaugeResult) => void
}

/** 투구 결정 게이지. 0 → 1 → 0 을 오가며 가운데(1)에서 멈추면 PERFECT다. */
export function PitchGauge({ onThrow }: PitchGaugeProps) {
  const [value, setValue] = useState(0)
  const startedAtRef = useRef(0)

  useEffect(() => {
    startedAtRef.current = performance.now()
    let handle = 0
    const step = () => {
      const elapsed = (performance.now() - startedAtRef.current) % GAUGE_CYCLE_MILLISECONDS
      const ratio = elapsed / GAUGE_CYCLE_MILLISECONDS
      setValue(ratio < 0.5 ? ratio * 2 : (1 - ratio) * 2)
      handle = requestAnimationFrame(step)
    }
    handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
  }, [])

  return (
    <button type="button" className={styles.gauge} onClick={() => onThrow(judgeGauge(value - 1))}>
      <span className={styles.track}>
        <span className={styles.perfectZone} />
        <span className={styles.fill} style={{ width: `${value * 50}%` }} />
      </span>
      <span className={styles.label}>{judgeGauge(value - 1)}</span>
    </button>
  )
}
