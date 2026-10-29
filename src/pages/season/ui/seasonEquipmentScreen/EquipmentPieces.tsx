import { centeredOffsetOf } from '@/pages/season/lib/seasonEquipmentWindow'
import type { WindowBox, WindowRect } from '@/pages/season/lib/seasonEquipmentWindow'
import { pixel } from './equipmentAssets'

export function Rects({ rects, testId }: { readonly rects: readonly WindowRect[]; readonly testId?: string }) {
  return (
    <svg viewBox="0 0 240 320" shapeRendering="crispEdges" data-testid={testId} style={{ ...pixel, left: 0, top: 0, width: 240, height: 320 }}>
      {rects.map((rect, index) => (
        <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.color} />
      ))}
    </svg>
  )
}

interface RightImageProps {
  readonly src: string
  readonly box: WindowBox
  readonly width: number
  readonly height: number
  readonly ox: number
  readonly oy?: number
}

/** 정렬 0x24 — 오른쪽(ox) · 세로 가운데 */
export function RightImage({ src, box, width, height, ox, oy = 0 }: RightImageProps) {
  return <img alt="" src={src} style={{ ...pixel, left: box.x + box.width - width + ox, top: box.y + centeredOffsetOf(box.height, height) + oy }} />
}
