import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

/** 단색으로 찍는 글자 (원본 효과 0xb) — 그림을 마스크로 쓰고 색을 칠한다 */
export function MenuTintedLabel({
  src,
  left,
  top,
  width,
  height,
  color,
}: {
  readonly src: string
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly color: string
}) {
  return (
    <div
      className={styles.tintedLabel}
      style={{ left, top, width, height, background: solidColorCss(color), maskImage: spriteMaskImage(src), WebkitMaskImage: spriteMaskImage(src) }}
    />
  )
}
