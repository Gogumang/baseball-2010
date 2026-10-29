import { CommonPanel, FrameSprite, SolidStamp } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { TRADE_CONFIRM } from '@/pages/season/lib/tradeConfirmLayout'
import { IMG_TEXT_FRAMES, MODE_UI_FRAMES, type TradeConfirmPlayer } from './tradeConfirmWindow/confirmAssets'
import { CenteredImgText } from './tradeConfirmWindow/CenteredText'
import { PlayerRow } from './tradeConfirmWindow/PlayerRow'
import { CostChoices } from './tradeConfirmWindow/CostChoices'

export interface TradeConfirmWindowProps {
  /** this+0x154 — 0 투수 · 1 타자 */
  readonly isPitcherTab: boolean
  /** 내 선수(보상) — 박스 4 · 5 · 8 */
  readonly given: TradeConfirmPlayer
  /** 상대 선수(영입) — 박스 6 · 7 · 9 */
  readonly acquired: TradeConfirmPlayer
  /** 진행 단계가 아니면(this+0x160 == 0) 비용 칸 · 목록을 그린다 */
  readonly showsChoices: boolean
  /** 목록 [this+0x7c] 커서 */
  readonly cursor: number
  /** 웹 전용 — 비용 칸 줄 누름 (커서 줄이면 확인, 아니면 커서 옮김은 부르는 쪽) */
  readonly onPressRow?: (index: number) => void
  /** 웹 전용 — 누름 칸 이름에 붙이는 성공률 (원본 판에는 성공률 글이 없다) */
  readonly rateOf?: (index: number) => number
}

/** **트레이드 확인 0xe7 그림 0xd4e8** — 배치 근거는 `lib/tradeConfirmLayout` 머리말(직접 떴다) */
export function TradeConfirmWindow({ isPitcherTab, given, acquired, showsChoices, cursor, onPressRow, rateOf }: TradeConfirmWindowProps) {
  const modeUi = useFrameOrigins(MODE_UI_FRAMES)
  const imgText = useFrameOrigins(IMG_TEXT_FRAMES)
  const animations = useAnimations(MODE_UI_FRAMES)
  const update = useUpdateCounter()
  const T = TRADE_CONFIRM
  const step = animationStepAt(animations?.[T.animation] ?? [], update)

  return (
    <div role="group" aria-label="트레이드 확인" data-testid="트레이드-확인">
      <CommonPanel
        x={T.panel.x}
        y={T.panel.y}
        width={T.panel.width}
        height={T.panel.height}
        topBand={T.panel.topBand}
        titleTab
        testId="시즌-목록-판"
      />
      <FrameSprite folder={MODE_UI_FRAMES} frame={T.cellsFrame} origins={modeUi} x={0} y={0} />
      <SolidStamp folder={IMG_TEXT_FRAMES} frame={T.title.frame} origins={imgText} x={T.title.x} y={T.title.y} color={T.title.color} />
      {T.headers.map((header) => (
        <CenteredImgText key={header.frame} origins={imgText} frame={header.frame} box={header.box} />
      ))}
      {step !== null && <FrameSprite folder={MODE_UI_FRAMES} frame={step.frame} origins={modeUi} x={step.dx} y={step.dy} />}
      <PlayerRow player={given} row={T.myRow} isPitcherTab={isPitcherTab} modeUi={modeUi} imgText={imgText} testId="트레이드-보상" />
      <PlayerRow player={acquired} row={T.opponentRow} isPitcherTab={isPitcherTab} modeUi={modeUi} imgText={imgText} testId="트레이드-영입" />
      {showsChoices && <CostChoices given={given} acquired={acquired} cursor={cursor} modeUi={modeUi} onPressRow={onPressRow} rateOf={rateOf} />}
    </div>
  )
}
