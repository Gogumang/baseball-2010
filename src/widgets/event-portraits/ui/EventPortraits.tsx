import { useEffect, useRef, useState } from 'react'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { EventPortrait } from '@/shared/config/original/eventTypes'
import { placePortraits, slideX } from '@/widgets/event-portraits/lib/portraitSlots'
import type { PlacedPortrait } from '@/widgets/event-portraits/lib/portraitSlots'
import * as styles from '@/widgets/event-portraits/ui/EventPortraits.css'

const SCREEN_WIDTH = 240

interface EventPortraitsProps {
  readonly portraits: readonly EventPortrait[]
  /** 판 높이. 인물 원점(발밑)을 판 바닥에 맞춘다 — 원작 세로 위치는 부르는 코드 안이라 **추정**이다. */
  readonly height: number
}

/** 원작 이벤트 초상화. 좌우 자리마다 PZX 애니메이션을 반복 재생하고, 새 인물은 미끄러져 들어온다. */
export function EventPortraits({ portraits, height }: EventPortraitsProps) {
  const placed = placePortraits(portraits, SCREEN_WIDTH)
  return (
    <div className={styles.stage} style={{ height }}>
      {placed.map((item) => (
        <PortraitSprite key={item.key} placed={item} baseline={height} />
      ))}
    </div>
  )
}

interface PortraitSpriteProps {
  readonly placed: PlacedPortrait
  readonly baseline: number
}

function PortraitSprite({ placed, baseline }: PortraitSpriteProps) {
  const folder = `/sprites/${placed.portrait.file}/frames`
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  const update = useUpdateClock()

  // 같은 자리에서 표정만 바뀌면 원작도 다시 들어오지 않는다 — 슬라이드는 자리 열쇠 기준이다.
  const slideStartRef = useRef(update)
  const slideUpdate = update - slideStartRef.current

  const entries = animations?.[placed.portrait.animation]
  const step = entries === undefined ? null : animationStepAt(entries, update)
  const key = step === null ? '' : String(step.frame).padStart(3, '0')
  // 빈 자리 프레임은 그림도 원점도 없다 — 원작도 아무것도 그리지 않는다.
  const origin = step === null ? undefined : origins?.[key]
  if (step === null || origin === undefined) return null

  const x = slideX(placed, slideUpdate, SCREEN_WIDTH) + origin.x + step.dx
  const y = baseline + origin.y + step.dy
  return <img className={styles.sprite} style={{ left: x, top: y }} src={`${folder}/${key}.png`} alt="" />
}

/** 원작 갱신 횟수. 한 번 갱신 = millisecondsPerFrame(). */
function useUpdateClock(): number {
  const [update, setUpdate] = useState(0)
  useEffect(() => {
    const startedAt = performance.now()
    let handle = 0
    const tick = (now: number) => {
      setUpdate(Math.floor((now - startedAt) / millisecondsPerFrame()))
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [])
  return update
}
