import { useEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import * as styles from '@/widgets/loading-tip/ui/LoadingTip.css'

/**
 * 원작 로딩 화면 — ui/loadingbar.pzx.
 *   프레임 0: "TIP:" 상자(170×147) + "DATA LOADING", 안쪽 칸 (7,16)~(162,87) 에 StrTIP 을 쓴다
 *   애니메이션 0: 프레임 1~4 달리는 선수
 * 상자를 화면 가운데 두는 것, 선수가 상자 아래 띠를 왼쪽→오른쪽으로 달리는 것,
 * 로딩 길이(LOADING_UPDATES)는 **추정**이다 — 원본 좌표·시간은 binary.mod 안에 있다.
 */
const FOLDER = '/sprites/loadingbar/frames'
const RUNNER_ANIMATION = 0
export const LOADING_UPDATES = 30
const RUNNER_START_X = 20
const RUNNER_END_X = 150
const RUNNER_FOOT_Y = 112

interface LoadingTipProps {
  readonly tip: string
  readonly onDone: () => void
}

export function LoadingTip({ tip, onDone }: LoadingTipProps) {
  const origins = useFrameOrigins(FOLDER)
  const animations = useAnimations(FOLDER)
  const [update, setUpdate] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const startedAt = performance.now()
    let handle = 0
    const tick = (now: number) => {
      const current = Math.floor((now - startedAt) / millisecondsPerFrame())
      setUpdate(current)
      if (current >= LOADING_UPDATES) {
        onDoneRef.current()
        return
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [])

  const step = animationStepAt(animations?.[RUNNER_ANIMATION] ?? [], update)
  const frameKey = step === null ? null : String(step.frame).padStart(3, '0')
  const origin = frameKey === null ? undefined : origins?.[frameKey]
  const progress = Math.min(1, update / LOADING_UPDATES)
  const runnerX = RUNNER_START_X + (RUNNER_END_X - RUNNER_START_X) * progress

  return (
    <div className={styles.overlay} role="status" aria-label="로딩 중">
      <div className={styles.box}>
        <img className={styles.sprite} src={`${FOLDER}/000.png`} alt="" />
        <div className={styles.tipArea}>
          <MarkupText raw={tip} />
        </div>
        {origin !== undefined && frameKey !== null && (
          <img
            className={styles.sprite}
            style={{ left: runnerX + origin.x, top: RUNNER_FOOT_Y + origin.y }}
            src={`${FOLDER}/${frameKey}.png`}
            alt=""
          />
        )}
      </div>
    </div>
  )
}
