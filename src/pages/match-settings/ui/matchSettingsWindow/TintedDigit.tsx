import { DETAIL_NUMBER, detailDigitWidthOf } from '@/pages/match-settings/lib/matchSettingsLayout'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { NUM_IMAGES, pngOf } from '@/pages/match-settings/ui/matchSettingsWindow/settingsAssets'

/** 0x585ac 한 자리 — 정렬 0x22(가운데 · 가운데)이고 효과 0xb 로 한 색만 칠한다 */
export function TintedDigit({
  digit,
  centerX,
  centerY,
  color,
}: {
  readonly digit: number
  readonly centerX: number
  readonly centerY: number
  readonly color: string
}) {
  const width = detailDigitWidthOf(digit)
  const image = spriteMaskImage(pngOf(NUM_IMAGES, DETAIL_NUMBER.base + digit))
  return (
    <span
      className={styles.tintedDigit}
      data-digit={digit}
      data-color={color}
      style={{
        left: centerX - (width >> 1),
        top: centerY - (DETAIL_NUMBER.height >> 1),
        width,
        height: DETAIL_NUMBER.height,
        background: solidColorCss(color),
        maskImage: image,
        WebkitMaskImage: image,
      }}
    />
  )
}
