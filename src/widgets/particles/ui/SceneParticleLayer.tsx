import { useEffect, useRef, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { drawParticles } from '@/widgets/particles/lib/renderParticles'
import {
  preloadSceneParticles,
  sceneParticleScene,
  tickSceneParticles,
} from '@/widgets/particles/model/sceneParticles'
import * as styles from '@/widgets/particles/ui/SceneParticleLayer.css'

/** 탭이 쉬다 돌아왔을 때 한꺼번에 따라잡는 틱 수 상한 (타석 장면과 같은 값) */
const CATCH_UP_LIMIT = 4
const WIDTH = 240
const HEIGHT = 320

interface SceneParticleLayerProps {
  /** 원본 전역 난수 — 이미터 틱 0x6dad0 · 알 만들기 0x6d56c · 갱신 0x6d878 이 굴린다 */
  readonly random: RandomPort
}

/**
 * **경기 장면 밖 화면의 파티클 층** — 장면 프레임이 그림마다 관리자 틱 0x6de85 → 그리기 0x6dd69 를 부르는 자리
 * (`sceneParticles` 머리 표). 메인 메뉴 0x103 은 공용 창(0x746cd) **다음**에 그리므로 이 층은 히든 오픈 알림 창 위에 놓는다.
 * 원본 틱(`millisecondsPerFrame`)마다 한 번 굴리고 그린다. 이미터가 없으면 굴림도 그림도 없다(난수를 안 돌린다).
 */
export function SceneParticleLayer({ random }: SceneParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const randomRef = useRef(random)
  randomRef.current = random
  const [isShown, setIsShown] = useState(false)

  useEffect(() => {
    preloadSceneParticles()
    const scene = sceneParticleScene()
    const startedAt = performance.now()
    let steppedTick = 0
    let wasShown = false
    let handle = 0
    const frame = (now: number) => {
      const tick = Math.floor((now - startedAt) / millisecondsPerFrame())
      if (scene.emitters.length === 0) {
        steppedTick = tick
      } else {
        if (tick - steppedTick > CATCH_UP_LIMIT) steppedTick = tick - CATCH_UP_LIMIT
        while (steppedTick < tick) {
          steppedTick += 1
          tickSceneParticles(randomRef.current)
        }
      }
      const shows = scene.emitters.length > 0
      if (shows !== wasShown) {
        wasShown = shows
        setIsShown(shows)
      }
      const context = canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null
      if (context !== null && shows) {
        context.fillStyle = '#000'
        context.fillRect(0, 0, WIDTH, HEIGHT)
        drawParticles(context, scene)
      }
      handle = requestAnimationFrame(frame)
    }
    handle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(handle)
  }, [])

  return (
    <div className={styles.layer} style={isShown ? undefined : { display: 'none' }}>
      <canvas ref={canvasRef} className={styles.canvas} width={WIDTH} height={HEIGHT} />
    </div>
  )
}
