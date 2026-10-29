import { FrameSprite, PressArea } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { TRADE_CONFIRM, tradeBoostTextOf, tradeCostBoxPaintsOf, tradeCostTextOf } from '@/pages/season/lib/tradeConfirmLayout'
import { MODE_UI_FRAMES, pixel, type TradeConfirmPlayer } from './confirmAssets'
import { CenteredMarkup, RoundBorder } from './CenteredText'

const tradeBoostLabelOf = (index: number) =>
  parseGameMarkup(tradeBoostTextOf(index))
    .flatMap((line) => line.segments.map((s) => s.text))
    .join('')

interface CostChoicesProps {
  readonly given: TradeConfirmPlayer
  readonly acquired: TradeConfirmPlayer
  readonly cursor: number
  readonly modeUi: FrameOrigins | null
  readonly onPressRow: ((index: number) => void) | undefined
  readonly rateOf: ((index: number) => number) | undefined
}

/** 진행 단계가 아니면(this+0x160 == 0) — 목록 판 · 비용 상자 · 비용 글 · 커서 테두리 · 비용 칸 셋 · 누름 칸 */
export function CostChoices({ given, acquired, cursor, modeUi, onPressRow, rateOf }: CostChoicesProps) {
  const T = TRADE_CONFIRM
  const cursorRow = T.rows[cursor]
  return (
    <>
      <FrameSprite folder={MODE_UI_FRAMES} frame={T.listFrame} origins={modeUi} x={0} y={0} />
      {tradeCostBoxPaintsOf(T.costBox).map((paint, index) => (
        <span key={index} style={{ ...pixel, left: paint.x, top: paint.y, width: paint.width, height: paint.height, background: paint.color }} />
      ))}
      <CenteredMarkup raw={tradeCostTextOf(given.grade, acquired.grade)} box={T.costBox} color="#ffff00" testId="트레이드-비용" />
      {cursorRow !== undefined && (
        <RoundBorder x={cursorRow.x - 1} y={cursorRow.y - 1} width={cursorRow.width + 1} height={cursorRow.height + 1} color="#ffff00" />
      )}
      {T.rows.map((box, index) => (
        <CenteredMarkup key={index} raw={tradeBoostTextOf(index)} box={box} color="#ffffff" testId={`트레이드-비용칸-${index}`} />
      ))}
      {onPressRow !== undefined &&
        T.rows.map((box, index) => (
          <PressArea
            key={`p${index}`}
            label={`${tradeBoostLabelOf(index)}${rateOf === undefined ? '' : ` 성공률 ${rateOf(index)}%`}`}
            rect={box}
            onPress={() => onPressRow(index)}
          />
        ))}
    </>
  )
}
