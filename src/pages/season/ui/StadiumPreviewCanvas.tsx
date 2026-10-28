import { useEffect, useRef } from 'react'
import { drawStadiumPreview } from '@/widgets/batting-stage/lib/renderScenery'
import { createDrawMemo } from '@/shared/lib/canvas/drawMemo'
import type { StadiumPreviewState } from '@/widgets/batting-stage/lib/renderScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * 구장관리 0xea 의 구장 그림 (그리기 `0xb158` — `drawStadiumPreview`). 그림이 늦게 실려도 보이도록 틀마다 다시 그린다 —
 * 구름은 흘리지 않고, 전광판 글자는 상점(0xb1f8)만 부르는 쪽이 `scoreboardX` 로 흘린다.
 */
export function StadiumPreviewCanvas({ state }: { readonly state: StadiumPreviewState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    let frame = 0
    /** 값 · 실린 그림이 바뀐 틀에서만 다시 칠한다(`createDrawMemo`) */
    const drawMemo = createDrawMemo()
    const draw = () => {
      const context = canvasRef.current?.getContext('2d') ?? null
      if (context !== null && drawMemo.needsDraw(canvasRef.current, stateRef.current)) drawStadiumPreview(context, stateRef.current)
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      aria-hidden
      data-testid="구장-미리보기"
      data-sky-column={state.skyColumn}
      data-scoreboard-x={state.scoreboardX}
      style={{ position: 'absolute', left: 0, top: 0 }}
    />
  )
}
