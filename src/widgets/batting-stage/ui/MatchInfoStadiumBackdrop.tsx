import { useEffect, useRef } from 'react'
import { drawMatchInfoStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { createDrawMemo } from '@/shared/lib/canvas/drawMemo'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { finishSkinBackdropOnCanvas } from '@/shared/lib/screen565/screen565'
import { tryOr } from '@/shared/lib/safe/tryOr'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

/** 그림이 다 실렸는지 가늠하는 표본 간격 — 날 그림이 바뀌었을 때만 흐리기를 다시 한다 */
const SAMPLE_STEP = 97
/** 보이는 캔버스의 2D 문맥 옵션 — 흐리기(`finishSkinBackdropOnCanvas`)가 화소를 읽어 되놓는다 */
const TARGET_CONTEXT_OPTIONS: CanvasRenderingContext2DSettings = { willReadFrequently: true }

function checksumOf(context: CanvasRenderingContext2D): number {
  const { data } = context.getImageData(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  let sum = 0
  for (let index = 0; index < data.length; index += SAMPLE_STEP * 4) {
    sum = (sum * 31 + data[index] + (data[index + 1] << 8) + (data[index + 2] << 16)) >>> 0
  }
  return sum
}

/**
 * **경기정보 화면의 바탕** — `0x5fd04` 가 무대를 그려 흐리기 · 3줄 선 · 흰 단계 3 을 한 뒤 떠 둔 버퍼(`0x581dc(스킨, 무대, 1)`)를
 * 그림마다 (0, 0) 에 찍는다(`drawMatchInfoStadium` 머리말). 원본은 들어올 때 한 번 뜨므로 구름 · 전광판이 안 흐른다.
 * 웹은 스프라이트가 늦게 실리므로 날 그림(흐리기 앞)이 바뀔 때마다 다시 뜬다 — 다 실린 뒤로는 같은 그림이다.
 * `stage` 가 없으면(그 진입을 안 지났으면) 아무것도 안 그린다.
 */
export function MatchInfoStadiumBackdrop({ stage }: { readonly stage: MatchInfoStadiumState | null | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef(stage)
  useMirrorRef(stageRef, stage)
  /** 값이 같으면 같은 그림 — 부르는 쪽이 객체를 새로 만들어도 다시 뜨지 않는다 */
  const stageKey = stage === null || stage === undefined ? null : JSON.stringify(stage)

  useEffect(() => {
    if (stageKey === null) return undefined
    let frame = 0
    let lastChecksum: number | null = null
    /** 날 그림은 값 · 실린 그림이 바뀐 틀에서만 다시 뜬다(`createDrawMemo`) — 화소 읽기(`checksumOf`)도 그때만 */
    const drawMemo = createDrawMemo()
    const raw = tryOr(() => {
      const offscreen = document.createElement('canvas')
      offscreen.width = STAGE_WIDTH
      offscreen.height = STAGE_HEIGHT
      return offscreen.getContext('2d', { willReadFrequently: true })
    }, null)
    const draw = () => {
      // 흐리기가 이 캔버스를 그림이 실릴 때마다 다시 읽는다 — CPU 버퍼로 열어야 Chrome 의
      // "Multiple readback operations using getImageData" 경고가 안 난다(픽셀 값은 같다)
      const target = canvasRef.current?.getContext('2d', TARGET_CONTEXT_OPTIONS) ?? null
      const current = stageRef.current
      if (raw !== null && target !== null && current !== null && current !== undefined && drawMemo.needsDraw(canvasRef.current, current)) {
        drawMatchInfoStadium(raw, current)
        const checksum = checksumOf(raw)
        if (checksum !== lastChecksum) {
          lastChecksum = checksum
          target.drawImage(raw.canvas, 0, 0)
          finishSkinBackdropOnCanvas(target, STAGE_WIDTH, STAGE_HEIGHT)
        }
      }
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [stageKey])

  if (stage === null || stage === undefined) return null
  return (
    <canvas
      ref={canvasRef}
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      aria-hidden
      data-testid="경기정보-구장"
      data-stadium={stage.stadium}
      style={{ position: 'absolute', left: 0, top: 0 }}
    />
  )
}
