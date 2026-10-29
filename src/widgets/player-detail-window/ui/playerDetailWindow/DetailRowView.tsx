import type { ReactNode } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { FrameSprite } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import {
  DETAIL_LABEL_CELL,
  DETAIL_LABEL_DX,
  DETAIL_LABEL_DY,
  DETAIL_VALUE_CELL,
  DETAIL_VALUE_DX,
  type PlayerDetail,
} from '@/widgets/player-detail-window/lib/playerDetailWindow'
import { DetailTicker } from '@/widgets/player-detail-window/ui/playerDetailWindow/DetailTicker'
import { GAME_UI_FRAMES, pixel } from '@/widgets/player-detail-window/ui/playerDetailWindow/detailAssets'
import { CenteredImgText } from '@/widgets/player-detail-window/ui/playerDetailWindow/detailPrimitives'

type DetailRowLayout = { readonly labelFrame: number; readonly cellDy: number; readonly labelDy: number; readonly textDy: number }

/**
 * 줄 하나 — 칸 x + 9 (game_ui 23) · 이름 글 · 값 칸 x + 39 (game_ui 28) · 값. 가운데 글은 늘, 흐르는 글은 창이 다 열린 뒤에만 그린다.
 * `tickerCounter` 는 이 줄의 흐르는 글이 그려지는 카운터(그림의 카운터 + 3 × 그 앞 흐르는 글 수)다.
 */
export function DetailRowView({
  index,
  row,
  value,
  x,
  y,
  isOpen,
  tickerCounter,
  gameUi,
  imgText,
}: {
  readonly index: number
  readonly row: DetailRowLayout
  readonly value: PlayerDetail['values'][number] | undefined
  readonly x: number
  readonly y: number
  readonly isOpen: boolean
  readonly tickerCounter: number
  readonly gameUi: FrameOrigins | null
  readonly imgText: FrameOrigins | null
}) {
  const labelX = x + DETAIL_LABEL_DX
  const valueX = x + DETAIL_VALUE_DX
  const textY = y + row.textDy
  return (
    <div data-testid={`선수 정보 줄 ${index}`} aria-label={value?.text}>
      <FrameSprite folder={GAME_UI_FRAMES} frame={DETAIL_LABEL_CELL} origins={gameUi} x={labelX} y={y + row.cellDy} />
      <CenteredImgText origins={imgText} frame={row.labelFrame} x={labelX} y={y + row.labelDy + DETAIL_LABEL_DY} width={25} />
      <FrameSprite folder={GAME_UI_FRAMES} frame={DETAIL_VALUE_CELL} origins={gameUi} x={valueX} y={y + row.cellDy} />
      {detailValueOf(value, valueX, textY, isOpen, tickerCounter)}
    </div>
  )
}

function detailValueOf(
  value: PlayerDetail['values'][number] | undefined,
  valueX: number,
  textY: number,
  isOpen: boolean,
  tickerCounter: number,
): ReactNode {
  if (value?.kind === 'text') {
    const textWidth = measurePixelTextWidth(value.text)
    return (
      <PixelText style={{ ...pixel, left: valueX + ((54 - textWidth) >> 1), top: textY + 2, color: ORIGINAL_COLORS.text }}>{value.text}</PixelText>
    )
  }
  if (value?.kind === 'ticker' && isOpen) return <DetailTicker text={value.text} x={valueX} y={textY + 2} counter={tickerCounter} />
  return null
}
