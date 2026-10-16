import type { CSSProperties } from 'react'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'

interface SolidStampProps {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  /** 프레임 원점이 놓일 화면 좌표 */
  readonly x: number
  readonly y: number
  /** 찍을 색 (`#rrggbb`) */
  readonly color: string
}

/**
 * 그림 효과 0xb(단색) — 프레임의 그림 꼴(불투명 픽셀)을 한 색으로 찍는다. 네 · 여덟 방향으로 1px 씩 옮겨 찍고 그 위에
 * 그림을 그리면 1px 테두리가 된다(외출 지도 고른 건물 0x7ec04 · 이름 0x7e300).
 * 찍는 색은 원본처럼 565 로 내린다(0x9ae95 · 0x98075 는 인자 색의 아래 16비트를 찍는다 — `solidColorCss`).
 */
export function SolidStamp({ folder, frame, origins, x, y, color }: SolidStampProps) {
  const key = String(frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  const mask = spriteMaskImage(`${folder}/${key}.png`)
  const style: CSSProperties = {
    position: 'absolute', left: x + origin.x, top: y + origin.y, width: origin.width, height: origin.height,
    background: solidColorCss(color), maskImage: mask, WebkitMaskImage: mask, maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
    pointerEvents: 'none',
  }
  return <div data-solid-stamp={color} style={style} />
}
