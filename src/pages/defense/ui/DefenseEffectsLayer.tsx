import { useEffect, useRef } from 'react'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import { DEFENSE_DISTANCE_BOARD, defenseDistanceGlyphsOf } from '@/pages/defense/lib/defenseDistanceBoard'
import type { HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner'
import { drawHomeRunTextFrame } from '@/widgets/batting-stage/lib/renderHomeRunBanner'
import { drawParticles, preloadPtcParts } from '@/widgets/particles/lib/renderParticles'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'

/** 비거리 판 0x36cd4 — 그리기 0x46c88 의 머리(0x46cb6)라 야수 · 주자 위, 글자 · 점수판 아래다 */
export function DefenseDistanceBoard({ value }: { readonly value: number }) {
  return (
    <div className={styles.overlay} data-testid="수비-비거리판" data-value={value}>
      <img className={styles.runScoreDigit} style={{ left: DEFENSE_DISTANCE_BOARD.x, top: DEFENSE_DISTANCE_BOARD.y }}
        src={DEFENSE_DISTANCE_BOARD.src} alt="" />
      {defenseDistanceGlyphsOf(value).map((glyph, index) => (
        <img key={index} className={styles.runScoreDigit} style={{ left: glyph.left, top: glyph.top }} src={glyph.src} alt="" />
      ))}
    </div>
  )
}

/** HOMERUN 글자 0x40b18 — 0x46e5c (득점 점수판 0x41a64 바로 앞) */
export function DefenseHomeRunText({ frame }: { readonly frame: HomeRunTextFrame }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const context = canvasRef.current?.getContext('2d') ?? null
    if (context === null) return
    context.clearRect(0, 0, styles.SCREEN_WIDTH, styles.SCREEN_HEIGHT)
    drawHomeRunTextFrame(context, frame)
  }, [frame])
  return (
    <canvas ref={canvasRef} className={styles.overlay} width={styles.SCREEN_WIDTH} height={styles.SCREEN_HEIGHT}
      data-testid="수비-홈런글자" />
  )
}

/** 프레임 끝 0x6dd68 — 파티클은 그 그림의 맨 위, 화면 좌표 그대로(카메라 칸 0) */
export function DefenseParticles({ scene, version }: { readonly scene: ParticleScene; readonly version: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => preloadPtcParts(), [])
  useEffect(() => {
    const context = canvasRef.current?.getContext('2d') ?? null
    if (context === null) return
    context.clearRect(0, 0, styles.SCREEN_WIDTH, styles.SCREEN_HEIGHT)
    drawParticles(context, scene)
  }, [scene, version])
  return <canvas ref={canvasRef} className={styles.overlay} width={styles.SCREEN_WIDTH} height={styles.SCREEN_HEIGHT} />
}
