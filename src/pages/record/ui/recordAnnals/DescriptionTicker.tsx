import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import { measureRawTextWidth } from '@/shared/lib/font'
import { DESCRIPTION_TICKER, tickerTextXOf } from '@/pages/record/lib/recordAnnalsLayout'
import * as styles from '@/pages/record/ui/RecordAnnals.css'

/**
 * 탭 0 설명 — 흐르는 글 0x5a8c8. [skin+0x284] 로 x 를 정해 그린 **뒤** 3 올린다(0x5a958~0x5a962) —
 * 그래서 올리기는 그림이 화면에 나간 뒤(effect)에 한다.
 */
export function DescriptionTicker({ text, tick }: { readonly text: string; readonly tick: number }) {
  const counter = useSkinTickerCounter(tick)
  // 글 = "" + "!cffffff"(0xcf934) + 설명 (0x2e9e0~0x2ea1e). 글폭은 0x5a91a 의 0x9c52c 가 **서식까지** 잰 날 글 폭이다
  const raw = `!cffffff${text}`
  const textWidth = measureRawTextWidth(raw)
  const segments = parseGameMarkup(raw).flatMap((line) => line.segments)
  const { x, y, width, height, clipInset } = DESCRIPTION_TICKER
  return (
    <div className={styles.tickerClip} data-testid="기록-설명" style={{ left: x + clipInset, top: y, width: width - clipInset * 2, height }}>
      <span className={styles.tickerText} style={{ left: tickerTextXOf(counter, textWidth) - (x + clipInset) }}>
        {segments.map((segment, index) => (
          <span key={index} style={segment.color === null ? undefined : { color: segment.color }}>
            {segment.text}
          </span>
        ))}
      </span>
    </div>
  )
}
