import { useEffect, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  MENU_WHEEL_CENTER, MENU_WHEEL_RINGS, SCREEN_HEIGHT, SCREEN_WIDTH,
} from '@/pages/main-menu/lib/mainMenuLayout'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

/**
 * 반원 바퀴의 바닥 — 가운데에서 도는 공과 테두리 원 3겹만 그린다. 칸 글자는 부르는 쪽이 얹는다.
 *
 * 원본 0x24cda~0x24d70 (확정):
 *   main_ball 애니 0 을 기준점 (120,320) 에 그리고 (진행=1 이라 매 갱신 다음 칸으로 넘어간다),
 *   그 위에 `0x6ba3d(ctx, 120, 320, 93+k, 색)` 으로 반지름 93·95·97 원을 얹는다.
 *
 * ⚠️ 공을 그리는 조건 `[+0xe6] ≥ 0` 의 뜻을 몰라 늘 그린다 — **근사**.
 */
const BALL_FOLDER = './sprites/main_ball/frames'
const BALL_ANIMATION = 0

export function MenuWheel() {
  const origins = useFrameOrigins(BALL_FOLDER)
  const animations = useAnimations(BALL_FOLDER)
  const [update, setUpdate] = useState(0)

  // 원본은 그리기마다 애니를 한 칸씩 진행시킨다 — 웹은 갱신 시간(millisecondsPerFrame)으로 센다.
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

  const step = animationStepAt(animations?.[BALL_ANIMATION] ?? [], update)
  const frameKey = step === null ? null : String(step.frame).padStart(3, '0')
  const origin = frameKey === null ? undefined : origins?.[frameKey]

  return (
    <>
      {origin !== undefined && frameKey !== null && (
        <img
          className={styles.layer}
          style={{ left: MENU_WHEEL_CENTER.x + origin.x, top: MENU_WHEEL_CENTER.y + origin.y }}
          src={`${BALL_FOLDER}/${frameKey}.png`}
          alt=""
        />
      )}
      <svg
        className={styles.layer}
        style={{ left: 0, top: 0 }}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}
        aria-hidden="true"
      >
        {MENU_WHEEL_RINGS.map((ring) => (
          <circle
            key={ring.radius}
            cx={MENU_WHEEL_CENTER.x}
            cy={MENU_WHEEL_CENTER.y}
            r={ring.radius}
            fill="none"
            stroke={ring.color}
            strokeWidth={1}
          />
        ))}
      </svg>
    </>
  )
}
