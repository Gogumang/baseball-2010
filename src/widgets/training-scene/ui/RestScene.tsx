import { useEffect, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TRAINING_POPUP_UPDATES } from '@/shared/config/original/trainingAnimation'
import { useSceneHour } from '@/shared/lib/phoneClock/phoneClock'
import { useModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import { isRestSkipKey } from '@/widgets/training-scene/lib/restPresentation'
import type { RestPresentation } from '@/widgets/training-scene/lib/restPresentation'
import { EventAnimationSprite } from '@/widgets/training-scene/ui/EventAnimationSprite'
import { TrainingGauge } from '@/widgets/training-scene/ui/TrainingGauge'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

const EVENT_ANI = './sprites/event_ani/frames'
const EVENT_CHAR_0 = './sprites/event_char_0/frames'
const WINDOW_FOLDER = './sprites/mode_back/frames'
/** 0x848d0(gfx, 0, 0) — 기준점 ((R.x + R.w)/2, R.y + R.h) = (120, 137) (훈련 팝업과 같다) */
const ANCHOR = { x: 120, y: 137 }
/** mode_back 을 (1, 52) 에 — 잘라내기 틀 (1, 66) 안에서 y −14 */
const WINDOW_OFFSET_Y = 52 - 66

export interface RestSceneProps {
  readonly presentation: RestPresentation
  /** event_char_0 벌 — 나리는 피부 − 1 (`portraitPaletteIndex`, 0x852ca). null 이면 구운 그림 그대로 */
  readonly char0Palette: number | null
  /** 게이지 끝 — 0x84e58 이 참이 되는 틀에 0x18e3c(굴림 · 결과 창)로 간다. 한 번만 불린다 */
  readonly onFinished: () => void
}

/**
 * 나만의리그 127 휴식 연출 (`lib/restPresentation` 머리말). 관리 화면(0x19da4) 위 훈련 팝업 자리에 캐릭터 없이
 * event_ani 애니 5 와 event_char_0 애니를 겹쳐 60 갱신 동안 돌린다. 확인 키(0x10650)는 게이지를 끝으로 건너뛴다.
 * 누름은 웹 입력이다 — 확인 키와 같은 일.
 */
export function RestScene({ presentation, char0Palette, onFinished }: RestSceneProps) {
  const eventOrigins = useFrameOrigins(EVENT_ANI)
  const eventAnimations = useAnimations(EVENT_ANI)
  const char0Origins = useFrameOrigins(EVENT_CHAR_0)
  const char0Animations = useAnimations(EVENT_CHAR_0)
  const windowOrigins = useFrameOrigins(WINDOW_FOLDER)
  /** 창 배경 0x7b9ac — 프레임 · 팔레트 = 시간대 [gfx+0x1c] */
  const windowSprite = useModeBackSprite(useSceneHour())
  const [update, setUpdate] = useState(0)
  const [isDone, setDone] = useState(false)
  const skipRef = useRef<() => void>(() => undefined)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    const startTick = appTickNow()
    let handle = 0
    let hasFinished = false
    const finish = () => {
      if (hasFinished) return
      hasFinished = true
      cancelAnimationFrame(handle)
      // 0x84e58 — 애니를 놓고 참을 돌려준다(이 뒤로 0x848d0 은 [+0x1c8] 이 비어 그리지 않는다)
      setDone(true)
      onFinishedRef.current()
    }
    const tick = (now: number) => {
      const current = Math.max(0, appTickOf(now) - startTick)
      setUpdate(current)
      if (current >= TRAINING_POPUP_UPDATES) return finish()
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    // 0x10650 — [gfx+0x1d0] = [gfx+0x1d8] (게이지 끝이라 다음 틀 0x84e58 이 끝을 본다 — 웹은 곧바로)
    skipRef.current = () => {
      setUpdate(TRAINING_POPUP_UPDATES)
      finish()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isRestSkipKey(event.key)) return
      event.preventDefault()
      skipRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      hasFinished = true
      cancelAnimationFrame(handle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (isDone) return null
  const windowOrigin = windowOrigins?.[windowSprite.key]
  return (
    <div data-testid="나리-휴식연출" style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 140, zIndex: 1 }}
      onClick={() => skipRef.current()}>
      <div className={styles.windowClip}>
        {windowOrigin !== undefined && (
          <img className={styles.sprite} style={{ left: windowOrigin.x, top: WINDOW_OFFSET_Y + windowOrigin.y }}
            src={windowSprite.src} alt="" />
        )}
      </div>
      <div className={styles.animationClip}>
        <EventAnimationSprite folder={EVENT_ANI} origins={eventOrigins}
          entries={eventAnimations?.[presentation.eventAnimation]} update={update} anchor={ANCHOR} />
        <EventAnimationSprite folder={EVENT_CHAR_0} origins={char0Origins}
          entries={char0Animations?.[presentation.char0Animation]} update={update} anchor={ANCHOR} palette={char0Palette} />
      </div>
      <TrainingGauge filled={update} />
    </div>
  )
}
