import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { teamNameFrameOf, tradeBadgeOf } from '@/pages/season/lib/tradeConfirmLayout'
import { MODE_UI_FRAMES, type Box, type TradeConfirmPlayer } from './confirmAssets'
import { CenteredImgText, CenteredMarkup } from './CenteredText'

/** 선수 한 줄 — 이름 · 팀 이름 · 보직 딱지 */
export function PlayerRow({
  player,
  row,
  isPitcherTab,
  modeUi,
  imgText,
  testId,
}: {
  readonly player: TradeConfirmPlayer
  readonly row: { readonly name: Box; readonly team: Box; readonly badge: Box }
  readonly isPitcherTab: boolean
  readonly modeUi: FrameOrigins | null
  readonly imgText: FrameOrigins | null
  readonly testId: string
}) {
  const badge = tradeBadgeOf(isPitcherTab, player.profileLow)
  return (
    <div data-testid={testId} aria-label={player.name}>
      <CenteredMarkup raw={player.name} box={row.name} color="#ffffff" />
      <CenteredImgText origins={imgText} frame={teamNameFrameOf(player.teamId)} box={row.team} />
      <FrameSprite folder={MODE_UI_FRAMES} frame={badge.chip} origins={modeUi} x={row.badge.x} y={row.badge.y} />
      <CenteredImgText origins={imgText} frame={badge.label} box={row.badge} />
    </div>
  )
}
