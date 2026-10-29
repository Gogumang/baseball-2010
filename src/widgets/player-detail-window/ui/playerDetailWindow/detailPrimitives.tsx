import { ORIGINAL_COLORS } from '@/shared/config/design'
import { IMG_TEXT_FRAMES, NUM, pad, pixel } from '@/widgets/player-detail-window/ui/playerDetailWindow/detailAssets'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { roundFillRectsOf, yearLabelOffsetOf } from '@/widgets/player-detail-window/lib/playerDetailWindow'
import type { yearCellDrawingOf } from '@/widgets/player-detail-window/lib/playerDetailWindow'

interface ColorRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

export function Rect({ x, y, width, height, color }: ColorRect) {
  if (width <= 0 || height <= 0) return null
  return <span style={{ ...pixel, left: x, top: y, width, height, background: color }} />
}

/** 둥근 칠 0x6b7d4 (둥글기 1) */
export function RoundFill({ x, y, width, height, color }: ColorRect) {
  return (
    <>
      {roundFillRectsOf({ x, y, width, height, round: 1 }).map((rect, index) => (
        <Rect key={index} {...rect} color={color} />
      ))}
    </>
  )
}

/** 0xb9d75 꼴 0x22 — (x, y, 폭, 15) 안 가운데 */
export function CenteredImgText({
  origins,
  frame,
  x,
  y,
  width,
}: {
  readonly origins: FrameOrigins | null
  readonly frame: number
  readonly x: number
  readonly y: number
  readonly width: number
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const offset = yearLabelOffsetOf(width, origin.width, origin.height)
  return <img alt="" src={`${IMG_TEXT_FRAMES}/${pad(frame)}.png`} style={{ ...pixel, left: x + offset.x, top: y + offset.y }} />
}

/** 0x6aff8(…, num 0x14, 앵커 4) — `yearCellDrawingOf` 는 칸 왼쪽(칸 x + 0x18 기준) */
export function CellNumber({ drawing, x, y }: { readonly drawing: ReturnType<typeof yearCellDrawingOf>; readonly x: number; readonly y: number }) {
  return (
    <>
      {drawing.glyphs.map((glyph, index) => (
        <img key={index} alt="" src={`${NUM}/${pad(glyph.frame)}.png`} style={{ ...pixel, left: x + glyph.x, top: y + 3 }} />
      ))}
      {drawing.dots.map((dot, index) => (
        <Rect key={`d${index}`} x={x + dot.x} y={y + dot.y} width={1} height={2} color={ORIGINAL_COLORS.text} />
      ))}
    </>
  )
}
