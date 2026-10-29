import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { loadSpriteImage } from '@/shared/lib/sprite/spriteCache'
import { composeOverlay565, rgbaOfScreen565, type ComposeImageOp, type ComposeOp } from '@/shared/lib/pixelEffect/screenCompose'
import { sprite565At } from '@/shared/lib/pixelEffect/sprite565Cache'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'

interface ComposedOverlayProps {
  /** 합성할 화면 사각형 (원작 화면 좌표) — 캔버스가 이 자리에 선다 */
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** 아래 겹이 이 사각형에 그린 것 — DOM 이 이미 그린 그림을 같은 좌표로 다시 (화면 좌표) */
  readonly underOps: readonly ComposeOp[]
  /** 이 겹이 그리는 것 — 원본 식 효과(효과 1 반투명 따위)로 아래에 섞는다 (화면 좌표) */
  readonly ops: readonly ComposeImageOp[]
  /** 아래 그리기 앞 바탕 색 (565) */
  readonly backdrop?: number
  /** 합성할 수 없을 때(캔버스 없음 · 그림을 못 받음) 대신 세우는 CSS 근사 */
  readonly fallback: ReactNode
  readonly testId?: string
}

/**
 * **겹 하나 합성 캔버스** (Q-03 r301) — DOM 겹이라 아래 화면을 못 읽는 반투명 자리에서, 아래 겹이 그린 그림을 **같은 좌표로 다시
 * 그려**(`underOps`) 원본 식(`screenCompose` — 효과 1 0x9a449 의 마스크 내림 · 565)으로 이 겹(`ops`)을 섞는다. 이 겹이 칠한 칸만
 * 찍고 나머지는 비워 DOM 아래 겹이 그대로 보인다. 그림이 다 오기 전 · 캔버스가 없을 때(시험 DOM)는 `fallback`(CSS 불투명도 근사)을 세운다.
 * 아래 겹이 이 사각형에서 바뀌지 않는(또는 같이 다시 그리는) 자리에만 쓴다.
 */
export function ComposedOverlay({ rect, underOps, ops, backdrop = 0, fallback, testId }: ComposedOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isComposed, setComposed] = useState(false)
  const [loadedVersion, setLoadedVersion] = useState(0)
  const key = useMemo(() => JSON.stringify([rect, underOps, ops, backdrop]), [rect, underOps, ops, backdrop])

  useLayoutEffect(() => {
    const drawn = composeOverlay565(rect, underOps, ops, sprite565At, backdrop)
    if (drawn.missing) {
      setComposed(false)
      let isCurrent = true
      const waiting = [...new Set([...underOps, ...ops].flatMap((op) => (op.kind === 'image' && sprite565At(op.src) === null ? [op.src] : [])))]
      void Promise.all(waiting.map((src) => loadSpriteImage(src))).then((loaded) => {
        // 다 받았으면 다시 그린다 — 하나라도 못 받으면 근사로 둔다(같은 실패를 되풀이하지 않는다)
        if (isCurrent && loaded.length > 0 && loaded.every((image) => image !== null)) setLoadedVersion((version) => version + 1)
      })
      return () => {
        isCurrent = false
      }
    }
    const context = effectContextOf(canvasRef.current)
    if (context === null) {
      setComposed(false)
      return undefined
    }
    const image = context.createImageData(rect.width, rect.height)
    rgbaOfScreen565(drawn.pixels, image.data, drawn.touched)
    context.putImageData(image, 0, 0)
    setComposed(true)
    return undefined
    // 그리기는 내용(key)으로 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loadedVersion])

  const style: CSSProperties = {
    position: 'absolute',
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    imageRendering: 'pixelated',
    pointerEvents: 'none',
    visibility: isComposed ? 'visible' : 'hidden',
  }
  return (
    <>
      <canvas ref={canvasRef} width={rect.width} height={rect.height} style={style} aria-hidden data-testid={testId} data-composed={isComposed} />
      {!isComposed && fallback}
    </>
  )
}
