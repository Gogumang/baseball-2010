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
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

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
type SceneParticles = ReturnType<typeof sceneParticleScene>

/** 이 그림의 틱을 굴리지 않는가 — 입자가 없거나, 다른 화면 루프가 맡았거나, 공용 창에 막혔거나, 틱을 맡은 장면 부품이 있다 */
function isTickPaused(scene: SceneParticles, isClaimed: boolean, isGated: boolean): boolean {
  return scene.emitters.length === 0 || isClaimed || isGated || isSceneParticleTickHeld()
}

/** 보이는가 — 입자가 있고 다른 루프 · 공용 창에 안 막혔다 */
const showsParticles = (scene: SceneParticles, isClaimed: boolean, isGated: boolean): boolean => scene.emitters.length > 0 && !isClaimed && !isGated

/**
 * 지난 틱 뒤부터 이 틱까지 굴린다(따라잡기는 `CATCH_UP_LIMIT` 까지). 앱 틀당 한 번 — 화면이 바뀌는 틀에 타석 · 수비 판 루프가
 * 이 틀을 이미 굴렸으면 건너뛴다(`claimSceneParticleTick`). 굴린 마지막 틱을 낸다
 */
function rollSceneParticleTicks(
  scene: SceneParticles,
  startTick: number,
  steppedTick: number,
  tick: number,
  randomRef: { readonly current: RandomPort },
): number {
  let stepped = Math.max(steppedTick, tick - CATCH_UP_LIMIT)
  while (stepped < tick) {
    stepped += 1
    if (claimSceneParticleTick(scene, startTick + stepped)) tickSceneParticles(randomRef.current)
  }
  return stepped
}

/** 검게 지우고 입자를 그린다 */
function paintParticleFrame(context: CanvasRenderingContext2D, scene: SceneParticles): void {
  context.fillStyle = '#000'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  drawParticles(context, scene)
}

export function SceneParticleLayer({ random, isGameScene = false }: SceneParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const randomRef = useRef(random)
  useMirrorRef(randomRef, random)
  const isGameSceneRef = useRef(isGameScene)
  useMirrorRef(isGameSceneRef, isGameScene)
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
      steppedTick = isTickPaused(scene, isClaimed, isGated) ? tick : rollSceneParticleTicks(scene, startTick, steppedTick, tick, randomRef)
      const shows = showsParticles(scene, isClaimed, isGated)
      if (shows !== wasShown) {
        wasShown = shows
        setIsShown(shows)
      }
      const context = effectContextOf(canvasRef.current)
      if (context !== null && shows && drawMemo.needsDraw(canvasRef.current, particleSignatureOf(scene))) paintParticleFrame(context, scene)
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
