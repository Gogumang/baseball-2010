import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { SKIN_TICKER_CLIP_INSET, skinTickerTextXOf, useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import { measureRawTextWidth } from '@/shared/lib/font'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import * as styles from '@/pages/team-game/ui/SettlementBoard.css'

/**
 * 0x4aef0 `0x5a8c8(skin, 글, W/2 − 0x51, r7 + 3, 162, 18, 1, 1, 1)` — 자르기 (x + 2, y, w − 4, h) ·
 * 글 왼쪽 = x + w − [skin+0x284] % (글폭 + w) · 그린 뒤 3 올린다 (`shared/lib/skinTicker`).
 */
export function RewardTicker({
  text,
  box,
}: {
  readonly text: string
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}) {
  const tick = useSceneTick()
  const counter = useSkinTickerCounter(tick)
  // 글폭은 0x5a91a 의 0x9c52c 가 **서식까지** 잰 날 글 폭 — 글 = "" + "승리 추가 보상[!cffff00"(0xd060c) + 수 + " G포인트!cffffff]"(0xd0624)
  // (0x4ae56~0x4ae96)이라 서식 글자 열여섯도 폭에 든다
  const textWidth = measureRawTextWidth(text)
  const segments = parseGameMarkup(`!cffffff${text}`).flatMap((line) => line.segments)
  const clipLeft = box.x + SKIN_TICKER_CLIP_INSET
  return (
    <div
      className={styles.tickerClip}
      data-testid="정산-흐르는-글"
      style={{ left: clipLeft, top: box.y, width: box.width - SKIN_TICKER_CLIP_INSET * 2, height: box.height }}
    >
      <span className={styles.tickerText} style={{ left: skinTickerTextXOf(box.x, box.width, counter, textWidth) - clipLeft }}>
        {segments.map((segment, index) => (
          <span key={index} style={segment.color === null ? undefined : { color: segment.color }}>
            {segment.text}
          </span>
        ))}
      </span>
    </div>
  )
}
