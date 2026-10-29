import { ORIGINAL_COLORS } from '@/shared/config/design'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import { SKIN_TICKER_CLIP_INSET, skinTickerTextXOf } from '@/shared/lib/skinTicker/skinTicker'
import { PixelText } from '@/shared/ui/PixelText/PixelText'

/** 흐르는 글 0x5a8c8(skin, 글, x, y, 54, 15, _, 자르기 1, 올리기 1) */
export function DetailTicker({ text, x, y, counter }: { readonly text: string; readonly x: number; readonly y: number; readonly counter: number }) {
  const width = 54
  const textWidth = measurePixelTextWidth(text)
  const clipLeft = x + SKIN_TICKER_CLIP_INSET
  return (
    <div style={{ position: 'absolute', left: clipLeft, top: y, width: width - SKIN_TICKER_CLIP_INSET * 2, height: 15, overflow: 'hidden' }}>
      <PixelText
        style={{
          position: 'absolute',
          left: skinTickerTextXOf(x, width, counter, textWidth) - clipLeft,
          top: 0,
          color: ORIGINAL_COLORS.text,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </PixelText>
    </div>
  )
}
