import { useEffect, useRef, useState } from 'react'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { animationFolderOf, TRAINING_POPUP_UPDATES } from '@/shared/config/original/trainingAnimation'
import type { TrainingPresentation } from '@/shared/config/original/trainingAnimation'
import { animationStepAt, figurePoseAt } from '@/widgets/training-scene/lib/animationPlayback'
import { TrainingFigure } from '@/widgets/training-scene/ui/TrainingFigure'
import { TrainingGauge } from '@/widgets/training-scene/ui/TrainingGauge'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

/** 연출 기준점 = 창 사각형 ((x + w) / 2, y + h) = (120, 137) (0x84954) */
const ANCHOR = { x: 120, y: 137 }
const WINDOW_FOLDER = './sprites/mode_back/frames'
/** 창 배경은 mode_back 을 (1, 52) 에 그린다 — 잘라내기 틀이 (1, 66) 이라 틀 안에서는 y −14 */
const WINDOW_OFFSET_Y = 52 - 66

/** 0xb8fbd: 시계로 창 배경을 고른다. 6~15시 0, 16~19시 1, 그 밖 2. */
function windowFrameOf(hour: number): string {
  if (hour >= 6 && hour <= 15) return '000'
  if (hour >= 16 && hour <= 19) return '001'
  return '002'
}

interface TrainingSceneProps {
  /** null 이면 연출 없이 창만 보인다 */
  readonly presentation: TrainingPresentation | null
  readonly caption?: string
  /** 게이지가 가득 차면(60번 갱신) 불린다 */
  readonly onFinished?: () => void
}

/** 원작 훈련 팝업. presentation 이 바뀔 때마다 처음부터 튼다. */
export function TrainingScene({ presentation, caption, onFinished }: TrainingSceneProps) {
  const folder = animationFolderOf(presentation?.file ?? 'raise_traning_ani')
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  const windowOrigins = useFrameOrigins(WINDOW_FOLDER)
  const [update, setUpdate] = useState(-1)

  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    if (presentation === null) {
      setUpdate(-1)
      return
    }
    const startedAt = performance.now()
    let handle = 0
    const tick = (now: number) => {
      const current = Math.floor((now - startedAt) / millisecondsPerFrame())
      setUpdate(current)
      if (current >= TRAINING_POPUP_UPDATES) {
        onFinishedRef.current?.()
        return
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [presentation])

  const entries = presentation === null ? null : animations?.[presentation.animation]
  const step = entries === undefined || entries === null || update < 0 ? null : animationStepAt(entries, update)
  const frameKey = step === null ? '' : String(step.frame).padStart(3, '0')
  const origin = step === null ? undefined : origins?.[frameKey]
  const figure = presentation?.figure ?? null
  const windowKey = windowFrameOf(new Date().getHours())
  const windowOrigin = windowOrigins?.[windowKey]

  return (
    <div className={styles.scene}>
      <div className={styles.windowClip}>
        {windowOrigin !== undefined && (
          <img
            className={styles.sprite}
            style={{ left: windowOrigin.x, top: WINDOW_OFFSET_Y + windowOrigin.y }}
            src={`${WINDOW_FOLDER}/${windowKey}.png`}
            alt=""
          />
        )}
      </div>
      <div className={styles.animationClip}>
        {origin !== undefined && step !== null && (
          <img
            className={styles.sprite}
            style={{ left: ANCHOR.x + origin.x + step.dx, top: ANCHOR.y + origin.y + step.dy }}
            src={`${folder}/${frameKey}.png`}
            alt=""
          />
        )}
        {figure !== null && step !== null && (
          <TrainingFigure
            pose={figurePoseAt(figure.poses, step.entryIndex)}
            x={ANCHOR.x + figure.offsetX}
            y={ANCHOR.y - figure.liftY}
          />
        )}
      </div>
      {presentation !== null && update >= 0 && <TrainingGauge filled={update} />}
      {caption !== undefined && <span className={styles.caption}>{caption}</span>}
    </div>
  )
}
