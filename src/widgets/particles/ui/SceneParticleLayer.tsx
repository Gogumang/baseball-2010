import { useEffect, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isCommonWindowShown } from '@/shared/lib/commonWindow/commonWindow'
import { drawParticles } from '@/widgets/particles/lib/renderParticles'
import { createDrawMemo } from '@/shared/lib/canvas/drawMemo'
import { particleSignatureOf } from '@/widgets/particles/lib/particleSignature'
import {
  claimSceneParticleTick,
  isSceneParticleTickHeld,
  isSceneParticlesClaimed,
  preloadSceneParticles,
  sceneParticleScene,
  tickSceneParticles,
} from '@/widgets/particles/model/sceneParticles'
import * as styles from '@/widgets/particles/ui/SceneParticleLayer.css'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'

/** 탭이 쉬다 돌아왔을 때 한꺼번에 따라잡는 틱 수 상한 (타석 장면과 같은 값) */
const CATCH_UP_LIMIT = 4
const WIDTH = 240
const HEIGHT = 320

interface SceneParticleLayerProps {
  /** 원본 전역 난수 — 이미터 틱 0x6dad0 · 알 만들기 0x6d56c · 갱신 0x6d878 이 굴린다 */
  readonly random: RandomPort
  /**
   * 경기 장면(0x104)이 서 있는가 — 그 프레임 0x52c50 만 공용 창 [0x140005c]+9 가 서 있으면 관리자 틱 0x6de85 · 그리기 0x6dd69 를
   * 둘 다 건너뛴다(53048~5304c). 메뉴 0x32dd8(32f48) · 시즌 0xe9ac(f112) · 나리 0x1cdec(1d480) · 미션 0x1eb0c(1eb2a)는 게이트가 없다
   */
  readonly isGameScene?: boolean
}

/**
 * **장면 파티클 층** — 장면 프레임이 그림마다 관리자 틱 0x6de85 → 그리기 0x6dd69 를 부르는 자리(`sceneParticles` 머리 표).
 * 메인 메뉴 0x103 은 공용 창(0x746cd) **다음**에 그리므로 이 층은 히든 오픈 알림 창 위에 놓는다.
 * 원본 틱(`millisecondsPerFrame`)마다 한 번 굴리고 그린다. 이미터가 없으면 굴림도 그림도 없다(난수를 안 돌린다).
 * 경기 장면 부품(타석 · 수비 판)이 관리자를 쥔 동안(`isSceneParticlesClaimed`)은 그 부품이 제 틱 차례로 굴리고 제 캔버스에 그리므로
 * 이 층은 굴리지도 그리지도 않는다 — 쥔 부품이 없는 경기 화면(교대 판 · 벤치 클리어링 · 사람 투구 장면 따위)은 이 층이 돌린다.
 */
export function SceneParticleLayer({ random, isGameScene = false }: SceneParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const randomRef = useRef(random)
  randomRef.current = random
  const isGameSceneRef = useRef(isGameScene)
  isGameSceneRef.current = isGameScene
  const [isShown, setIsShown] = useState(false)

  useEffect(() => {
    preloadSceneParticles()
    const scene = sceneParticleScene()
    const startTick = appTickNow()
    let steppedTick = 0
    let wasShown = false
    let handle = 0
    /** 입자 모습이 바뀐 틀에서만 다시 칠한다(`createDrawMemo`) — 굴림은 위에서 틀마다 그대로 */
    const drawMemo = createDrawMemo()
    const frame = (now: number) => {
      const tick = Math.max(0, appTickOf(now) - startTick)
      const isClaimed = isSceneParticlesClaimed()
      // 53048 — 경기 장면에 공용 창이 서 있으면 이 그림의 틱도 그림도 없다(따라잡지 않는다 — 원본 틀이 관리자를 안 부른 것이다).
      // 장면은 창이 선 첫 그림([창+0x250])에만 다시 그려지고(52efe~52f24) 그 그림에 파티클이 없으므로 멈춘 화면에도 파티클이 안 남는다
      const isGated = isGameSceneRef.current && isCommonWindowShown()
      // 틱만 맡은 장면 부품(`holdSceneParticleTicks` — 벤치 클리어링)이 있으면 그 부품이 제 갱신 뒤에 굴린다 — 여기는 그리기만
      if (scene.emitters.length === 0 || isClaimed || isGated || isSceneParticleTickHeld()) {
        steppedTick = tick
      } else {
        if (tick - steppedTick > CATCH_UP_LIMIT) steppedTick = tick - CATCH_UP_LIMIT
        while (steppedTick < tick) {
          steppedTick += 1
          // 앱 틀당 한 번 — 화면이 바뀌는 틀에 타석 · 수비 판 루프가 이 틀을 이미 굴렸으면 건너뛴다(`claimSceneParticleTick`)
          if (claimSceneParticleTick(scene, startTick + steppedTick)) tickSceneParticles(randomRef.current)
        }
      }
      const shows = scene.emitters.length > 0 && !isClaimed && !isGated
      if (shows !== wasShown) {
        wasShown = shows
        setIsShown(shows)
      }
      const context = effectContextOf(canvasRef.current)
      if (context !== null && shows && drawMemo.needsDraw(canvasRef.current, particleSignatureOf(scene))) {
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
