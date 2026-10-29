/** 장비 창의 그림 조각 — 프레임 · 정렬 프레임 · "+" · 색 사각형 (0xb9e05 · 0xb9d35 · 0x6a905) */
import type { CSSProperties } from 'react'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { ShopBox } from '@/pages/shop/lib/shopLayout'
import { PLUS_FRAME, alignedPositionOf } from '@/pages/shop/lib/equipmentWindowLayout'
import type { PixelRect } from '@/pages/shop/lib/equipmentWindowLayout'
import * as styles from '@/pages/shop/ui/EquipmentWindow.css'
import { NUM } from '@/pages/shop/ui/equipmentWindow/spriteFolders'

const pad = (frame: number) => String(frame).padStart(3, '0')

/** num "+" (6×6) — 0xb9d35 정렬 0x24 · 세로 가운데 내림 · oy 1 */
const PLUS_SIZE = { width: 6, height: 6 } as const
export function PlusSign({ target, ox }: { readonly target: ShopBox; readonly ox: number }) {
  const { x, y } = alignedPositionOf(target, PLUS_SIZE.width, PLUS_SIZE.height, 0x24, ox, 1, true)
  return <img className={styles.layer} alt="" src={`${NUM}/${pad(PLUS_FRAME)}.png`} style={{ left: x, top: y }} />
}

export function FramePicture({
  folder,
  frame,
  origins,
  x,
  y,
}: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly x: number
  readonly y: number
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  return <img className={styles.layer} alt="" src={`${folder}/${pad(frame)}.png`} style={{ left: x + origin.x, top: y + origin.y }} />
}

/** 0xb9e05 — 프레임을 박스에 정렬해 놓는다 (원점이 0 이 아닌 프레임은 원점만큼 더 민다) */
export function AlignedFrame({
  folder,
  frame,
  origins,
  target,
  align,
  ox = 0,
  oy = 0,
  style,
  testId,
  paletteIndex,
}: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly target: ShopBox
  readonly align: number
  readonly ox?: number
  readonly oy?: number
  readonly style?: CSSProperties
  readonly testId?: string
  readonly paletteIndex?: number
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const { x, y } = alignedPositionOf(target, origin.width, origin.height, align, ox, oy)
  return (
    <img
      className={styles.layer}
      alt=""
      data-testid={testId}
      data-frame={frame}
      data-palette={paletteIndex}
      src={`${folder}/${pad(frame)}.png`}
      style={{ left: x + origin.x, top: y + origin.y, ...style }}
    />
  )
}

export function PixelRects({ rects }: { readonly rects: readonly PixelRect[] }) {
  return (
    <svg className={styles.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
      {rects.map((rect, index) => (
        <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.color} />
      ))}
    </svg>
  )
}
