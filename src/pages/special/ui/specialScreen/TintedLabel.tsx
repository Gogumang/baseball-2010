import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { menuStyles } from '@/pages/special/ui/specialScreen/otherSlices'

interface TintedLabelProps {
  readonly src: string
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly color: string
}

/** 단색으로 찍는 글자 (원본 효과 0xb) — 그림을 마스크로 쓰고 색을 칠한다 */
export function TintedLabel({ src, left, top, width, height, color }: TintedLabelProps) {
  return (
    <div
      className={menuStyles.tintedLabel}
      style={{ left, top, width, height, background: solidColorCss(color), maskImage: spriteMaskImage(src), WebkitMaskImage: spriteMaskImage(src) }}
    />
  )
}
