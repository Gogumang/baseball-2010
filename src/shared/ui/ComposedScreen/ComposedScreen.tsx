import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { loadSpriteImage } from '@/shared/lib/sprite/spriteCache'
import { composeScreen565, rgbaOfScreen565, type ComposeOp } from '@/shared/lib/pixelEffect/screenCompose'
import { sprite565At } from '@/shared/lib/pixelEffect/sprite565Cache'

interface ComposedScreenProps {
  /** 그리기 차례 — 바탕 색 위에 원본 식(`screenCompose`)으로 덮어 쓴다 */
  readonly ops: readonly ComposeOp[]
  /** 화면 버퍼 처음 색 (565) — 그 장면이 먼저 칠하는 색 */
  readonly backdrop?: number
  readonly width?: number
  readonly height?: number
  readonly left?: number
  readonly top?: number
  readonly testId?: string
}

/**
 * **원본 화면 버퍼 합성 캔버스** — 아래 화면을 다 아는 밑그림(지도 따위)을 RGB565 버퍼 하나에 원본 식으로 그려 한 장으로 놓는다.
 * DOM 겹치기로는 반투명(효과 1 0x9a449) · 단계 덮기(0x9aac4 · 0x9a52c)의 마스크 내림 · 565 양자화를 못 따르므로 이 길을 쓴다.
 * 자리 · 크기는 원작 좌표 그대로다(키우기는 판 바깥 틀이 한다). 그림이 아직 안 왔으면 받은 뒤 다시 그린다.
 */
export function ComposedScreen({ ops, backdrop = 0, width = 240, height = 320, left = 0, top = 0, testId }: ComposedScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loadedVersion, setLoadedVersion] = useState(0)
  const opsKey = useMemo(() => JSON.stringify(ops), [ops])

  useLayoutEffect(() => {
    const context = canvasRef.current?.getContext('2d') ?? null
    if (context === null) return undefined
    const drawn = composeScreen565(width, height, backdrop, ops, sprite565At)
    const image = context.createImageData(width, height)
    rgbaOfScreen565(drawn.pixels, image.data)
    context.putImageData(image, 0, 0)
    if (!drawn.missing) return undefined
    let isCurrent = true
    const waiting = [...new Set(ops.flatMap((op) => (op.kind === 'image' && sprite565At(op.src) === null ? [op.src] : [])))]
    void Promise.all(waiting.map((src) => loadSpriteImage(src))).then((loaded) => {
      // 받은 것이 하나라도 있으면 다시 그린다 — 다 실패했으면 그대로(같은 실패를 되풀이하지 않는다)
      if (isCurrent && loaded.some((image) => image !== null)) setLoadedVersion((version) => version + 1)
    })
    return () => {
      isCurrent = false
    }
    // ops 는 내용(opsKey)으로 본다
  }, [opsKey, backdrop, width, height, loadedVersion])

  const style: CSSProperties = { position: 'absolute', left, top, width, height, imageRendering: 'pixelated', pointerEvents: 'none' }
  return <canvas ref={canvasRef} width={width} height={height} style={style} data-testid={testId} data-composed-ops={ops.length}
    data-composed-covers={ops.filter((op) => op.kind === 'cover').length} />
}
