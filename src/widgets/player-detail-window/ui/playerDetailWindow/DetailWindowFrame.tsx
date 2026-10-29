import { DETAIL_COLORS, roundEdgeRectsOf } from '@/widgets/player-detail-window/lib/playerDetailWindow'
import { Rect, RoundFill } from '@/widgets/player-detail-window/ui/playerDetailWindow/detailPrimitives'

/**
 * 창 틀 0x5476c → 0x5461c — 둥근 칠 #081C4A · 둥근 테두리 #335FCD · 점 넷 · 흰 칠 · 안쪽 파랑 칠 (`DETAIL_COLORS` 주석)
 */
export function DetailWindowFrame({
  x,
  y,
  width,
  height,
}: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}) {
  return (
    <>
      <RoundFill x={x} y={y} width={width} height={height} color={DETAIL_COLORS.outer} />
      {roundEdgeRectsOf(x + 1, y + 1, width - 2, height - 2).map((rect, index) => (
        <Rect key={index} {...rect} color={DETAIL_COLORS.edge} />
      ))}
      {[
        [x + 2, y + 2],
        [x + width - 2, y + 2],
        [x + 2, y + height - 2],
        [x + width - 2, y + height - 2],
      ].map(([px, py], index) => (
        <Rect key={`p${index}`} x={px} y={py} width={1} height={1} color={DETAIL_COLORS.edge} />
      ))}
      <RoundFill x={x + 2} y={y + 2} width={width - 4} height={height - 4} color={DETAIL_COLORS.white} />
      <RoundFill x={x + 4} y={y + 4} width={width - 8} height={height - 8} color={DETAIL_COLORS.edge} />
    </>
  )
}
