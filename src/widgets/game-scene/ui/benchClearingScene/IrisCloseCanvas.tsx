import { useEffect, useRef } from 'react'
import { irisHoleSpansOf } from '@/widgets/game-scene/lib/irisClose'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/**
 * **원 닫기 한 그림** — 0xbd5bc: 화면 크기(W × H) 그림을 검정으로 칠하고(0x14006e8(0, 0, W, H)) (255, 0, 255) 채운 원
 * 0x1400708(x, y, w, h, 0, 360) 으로 구멍을 뚫어 (0, 0) 에 찍는다. 구멍 칸은 `irisHoleSpansOf`(⚠️ 단말 함수라 화소 규칙은 미확인).
 */
export function IrisCloseCanvas({ x, y, size }: { readonly x: number; readonly y: number; readonly size: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const context = canvasRef.current?.getContext('2d') ?? null
    if (context === null) return
    context.globalCompositeOperation = 'source-over'
    context.fillStyle = '#000000'
    context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
    for (const span of irisHoleSpansOf(x, y, size)) context.clearRect(span.from, span.y, span.to - span.from + 1, 1)
  }, [x, y, size])
  return (
    <canvas
      ref={canvasRef}
      className={styles.cover}
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      data-testid="벤치-원닫기"
      data-size={size}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
