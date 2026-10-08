import { useEffect, useState } from 'react'
import { MarkupText } from '@/shared/ui/MarkupText/MarkupText'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  DESCRIPTION_BAND, DESCRIPTION_BAND_FADE_END, descriptionBandAt,
} from '@/pages/settings/lib/settingsLayout'
import * as styles from '@/pages/settings/ui/SettingsScreen.css'

const { r, g, b } = DESCRIPTION_BAND.color
const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha / 255})`

/**
 * 환경설정 설명 띠 0x55544 (`settingsLayout.ts` 의 `DESCRIPTION_BAND`). `seed` 가 바뀔 때마다 1 부터 다시 편다 —
 * 커서 격자가 바뀐 그림(0x59462)이다. 세로줄 알파는 80 까지 200, 그 뒤 줄마다 3 씩 빠지는 것을 그라데이션 한 장으로 그린다.
 * ⚠️ 유력: 화면에 들어선 첫 그림에서도 격자 바뀜 표시가 서 있다고 보고 펴며 시작한다 (진입의 [격자+0x25] 는 안 읽었다).
 */
export function DescriptionBand({ text, seed }: { readonly text: string; readonly seed: number }) {
  const [ticks, setTicks] = useState(0)
  const [lastSeed, setLastSeed] = useState(seed)
  if (lastSeed !== seed) {
    setLastSeed(seed)
    setTicks(0)
  }
  const band = descriptionBandAt(ticks)

  useEffect(() => {
    if (!band.isGrowing) return undefined
    const timer = window.setTimeout(() => setTicks((tick) => tick + 1), millisecondsPerFrame())
    return () => window.clearTimeout(timer)
  }, [band.isGrowing, ticks])

  const width = Math.min(band.spread, DESCRIPTION_BAND_FADE_END)
  const fadeEndAlpha = DESCRIPTION_BAND.alpha - DESCRIPTION_BAND.alphaStep * (DESCRIPTION_BAND_FADE_END - DESCRIPTION_BAND.solidUntil - 1)
  return (
    <>
      <div
        className={styles.descriptionBand}
        data-band-spread={band.spread}
        style={{
          top: DESCRIPTION_BAND.y,
          width,
          height: DESCRIPTION_BAND.height,
          background: `linear-gradient(to right, ${rgba(DESCRIPTION_BAND.alpha)} 0px, ${rgba(DESCRIPTION_BAND.alpha)} `
            + `${DESCRIPTION_BAND.solidUntil + 1}px, ${rgba(fadeEndAlpha)} ${DESCRIPTION_BAND_FADE_END}px)`,
          backgroundSize: `${DESCRIPTION_BAND_FADE_END}px 100%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
      {!band.isGrowing && (
        <div className={styles.descriptionText}
          style={{ left: DESCRIPTION_BAND.text.x, top: DESCRIPTION_BAND.y + DESCRIPTION_BAND.text.dy }}>
          <MarkupText raw={text} />
        </div>
      )}
    </>
  )
}
