import { useEffect, useRef } from 'react'
import { drawStadiumPreview } from '@/widgets/batting-stage/lib/renderScenery'
import type { StadiumPreviewState } from '@/widgets/batting-stage/lib/renderScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * 구장관리 0xea 의 구장 그림 (그리기 `0xb158` — `drawStadiumPreview`). 그림이 늦게 실려도 보이도록 틀마다 다시 그린다 —
 * 원본도 이 상태에서는 구름·전광판을 흘리지 않아 같은 그림이다.
 */
export function StadiumPreviewCanvas({ state }: { readonly state: StadiumPreviewState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    let frame = 0
    const draw = () => {
      const context = canvasRef.current?.getContext('2d') ?? null
      if (context !== null) drawStadiumPreview(context, stateRef.current)
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas ref={canvasRef} width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden data-testid="구장-미리보기"
      style={{ position: 'absolute', left: 0, top: 0 }} />
  )
}
