import { useMemo } from 'react'
import { commonPanelPaintsOf, insetBoxPaintsOf, roundBoxPaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import type { CommonPanelOptions, PanelPaint, RoundBoxOptions } from '@/shared/lib/commonPanel/commonPanel'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import * as styles from '@/shared/ui/CommonPanel/CommonPanel.css'

/** 원작 화면 크기 — 어둡게는 0x14008b8 · 0x14008c8 (W, H) 전체를 덮는다 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

interface PaintedRectsProps {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly paints: readonly PanelPaint[]
  readonly testId?: string
}

/** 칠 목록을 원작 화소 그대로 칠한다 (SVG 네모 — 뒤 칸이 앞 칸을 덮는다, 가장자리 흐림 없음) */
function PaintedRects({ x, y, width, height, paints, testId }: PaintedRectsProps) {
  if (width <= 0 || height <= 0) return null
  return (
    <svg
      className={styles.paint}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      style={{ left: x, top: y, width, height }}
      aria-hidden
      data-testid={testId}
    >
      {paints.map((paint, index) => (
        <rect key={index} x={paint.x} y={paint.y} width={paint.width} height={paint.height} fill={paint.color} />
      ))}
    </svg>
  )
}

interface CommonPanelProps extends CommonPanelOptions {
  /** 판 왼쪽 위 — 원본 정렬 비트로 옮긴 뒤 값 (`alignedTopLeftOf`) */
  readonly x: number
  readonly y: number
  /**
   * 열째 인자 [sp+0x90](u8) — ≠ 0 이면 판을 긋기 **전에** 화면 전체를 검정으로 덮는다 (0x55e70~0x55ebe, 직접 떴다):
   * ```
   * 55e7e  (u8)[sp+0x90] == 0 이면 건너뛴다
   * 55e88  W = 0x14008b8 · H = 0x14008c8 · 색 = 0x1400748(0, 0, 0)
   * 55ea8  [0x15605d0] 가 비어 있지 않으면 [0x15605d0](0, 0, W, H, 색, 단계 5)   ; 색 덮기 0x9b3f4 — 색 몫 (5 + 1)/16
   * ```
   * 그리는 틀마다 한 번이다 — 장면이 틀마다 다시 그려지면 겹치지 않는다(`POPUP_DIM_OPACITY` 와 같은 단계).
   */
  readonly dim?: boolean
  readonly testId?: string
}

/**
 * **공용 판 `0x55e60`** — 원본 선·칠 목록(`commonPanelPaintsOf`) 그대로 그린다.
 * 띠 · 제목 탭 · 어둡게는 부르는 자리의 인자(위 띠 [sp+0x84] · 아래 띠 [sp+0x88] · 제목 탭 [sp+0x8c] · 어둡게 [sp+0x90])를 그대로 넘긴다.
 */
export function CommonPanel({
  x, y, width, height, topBand = 0, bottomBand = 0, titleTab = false, dim = false, testId,
}: CommonPanelProps) {
  const paints = useMemo(
    () => commonPanelPaintsOf({ width, height, topBand, bottomBand, titleTab }),
    [width, height, topBand, bottomBand, titleTab],
  )
  const panel = <PaintedRects x={x} y={y} width={width} height={height} paints={paints} testId={testId ?? '공용판'} />
  if (!dim) return panel
  return (
    <>
      <div className={styles.paint} data-testid={`${testId ?? '공용판'}-어둡게`} aria-hidden
        style={{ left: 0, top: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }} />
      {panel}
    </>
  )
}

interface InsetBoxProps {
  /** 칸 왼쪽 위 — 원본 정렬 비트로 옮긴 뒤 값 */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly testId?: string
}

/** **안쪽 칸 `0xbb28c`** — #1D44A8 칠, 위·왼쪽 #08246B · 오른쪽·아래 #5A86FF 선 (`insetBoxPaintsOf`) */
export function InsetBox({ x, y, width, height, testId }: InsetBoxProps) {
  const paints = useMemo(() => insetBoxPaintsOf(width, height), [width, height])
  return <PaintedRects x={x} y={y} width={width} height={height} paints={paints} testId={testId} />
}

interface RoundBoxProps extends RoundBoxOptions {
  /** 칸 왼쪽 위 — 원본 정렬 비트로 옮긴 뒤 값 */
  readonly x: number
  readonly y: number
  readonly testId?: string
}

/**
 * **둥근 칸 `0x5eec4`** — 둥근 칠 · 둥근 테두리, 반사 인자가 서면 왼쪽 위 머리 반사 줄 (`roundBoxPaintsOf`).
 * 둥근 칠은 (w + 1) × (h + 1) 을 덮는다.
 */
export function RoundBox({ x, y, width, height, testId, ...options }: RoundBoxProps) {
  const { round, shine, shineLength, shineStep, shortShine, fill, edge } = options
  const paints = useMemo(
    () => roundBoxPaintsOf({ width, height, round, shine, shineLength, shineStep, shortShine, fill, edge }),
    [width, height, round, shine, shineLength, shineStep, shortShine, fill, edge],
  )
  return <PaintedRects x={x} y={y} width={width + 1} height={height + 1} paints={paints} testId={testId} />
}
