import { useEffect, useState } from 'react'
import { MarkupText } from '@/shared/ui/MarkupText/MarkupText'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  DESCRIPTION_BAND, DESCRIPTION_BAND_FADE_END, descriptionBandAt,
} from '@/shared/ui/DescriptionBand/descriptionBandLayout'
import * as styles from '@/shared/ui/DescriptionBand/DescriptionBand.css'

const { r, g, b } = DESCRIPTION_BAND.color
const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha / 255})`

/**
 * 설명 띠 0x55544 (`descriptionBandLayout.ts` 의 `DESCRIPTION_BAND`). `seed` 가 바뀔 때마다 1 부터 다시 편다 —
 * 부르는 쪽이 [skin+0x88] = 1 · [+0x8a] = 1 을 세우는 계기다. 세로줄 알파는 80 까지 200, 그 뒤 줄마다 3 씩 빠지는 것을
 * 그라데이션 한 장으로 그린다. 글이 비면(0x555d4 의 null 갈래) 띠만 그린다.
 * ⚠️ 유력: 띠가 화면에 처음 나타난 그림에서도 펴며 시작한다 (진입 때 [skin+0x8a] 값은 안 읽었다).
 */
export function DescriptionBand({ text, seed, initialTicks = 0 }: {
  readonly text: string
  readonly seed: number
  /**
   * 처음 그릴 때 이미 지난 펼침 갱신 수 — 띠 객체는 장면 것([장면+0xd8] 따위)이라 다른 하위 화면이 편 띠를 이어받는 자리가 쓴다
   * (투수 등록 0x67 → 0x66: 0x10b18 이 같은 띠를 다시 펴고, 0x66 진입 0x17360 은 이전 상태 0x67 이면 띠를 안 건드린다).
   */
  readonly initialTicks?: number
}) {
  const [ticks, setTicks] = useState(initialTicks)
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
        className={styles.band}
        data-description-band={band.spread}
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
      {!band.isGrowing && text !== '' && (
        <div className={styles.text}
          style={{ left: DESCRIPTION_BAND.text.x, top: DESCRIPTION_BAND.y + DESCRIPTION_BAND.text.dy }}>
          <MarkupText raw={text} />
        </div>
      )}
    </>
  )
}
