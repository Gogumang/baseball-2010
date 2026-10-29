import { useLayoutEffect, useRef, useState } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { SKIN_TICKER_CLIP_INSET, skinTickerTextXOf, useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { managementStyles as styles } from './otherSlices'

/**
 * 구장 줄 0x7ca7e — `0x5a8c8(skin, 글, 상자 x, y + 2, w, h, 1, 1, 1)`: 자르기 (x + 2, y, w − 4, h) ·
 * 글 왼쪽 = x + w − [skin+0x284] % (글폭 + w) · 그린 뒤 3 올린다 (`shared/lib/skinTicker` — 앱에 하나인 카운터).
 */
export function StadiumTicker({
  text,
  testId,
  box,
}: {
  readonly text: string
  readonly testId: string
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}) {
  const tick = useUpdateCounter()
  const counter = useSkinTickerCounter(tick)
  const textRef = useRef<HTMLSpanElement>(null)
  const [textWidth, setTextWidth] = useState(0)
  useLayoutEffect(() => setTextWidth(textRef.current?.offsetWidth ?? 0), [text])
  const clipLeft = box.x + SKIN_TICKER_CLIP_INSET
  return (
    <div
      className={styles.layer}
      data-testid={testId}
      style={{
        left: clipLeft,
        top: box.y,
        width: box.width - SKIN_TICKER_CLIP_INSET * 2,
        height: box.height,
        overflow: 'hidden',
      }}
    >
      <span
        ref={textRef}
        className={styles.infoValue}
        style={{
          left: skinTickerTextXOf(box.x, box.width, counter, textWidth) - clipLeft,
          top: 0,
          width: 'auto',
          whiteSpace: 'nowrap',
          color: ORIGINAL_COLORS.text,
        }}
      >
        {text}
      </span>
    </div>
  )
}
