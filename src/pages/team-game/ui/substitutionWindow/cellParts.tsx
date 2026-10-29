import type { CSSProperties } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { yearCellDrawingOf, yearLabelOffsetOf } from './otherSlices'
import { cursorBoxOf, roundEdgeRectsOf } from '@/pages/team-game/lib/substitutionWindow'
import { IMG_TEXT_FRAMES, NUM, pad, pixel } from './substitutionAssets'

/** 0x5650c · 0xb9d75 꼴 0x22 — (x, y, 폭, 15) 안 가운데 */
export function CenteredImgText({
  origins,
  frame,
  x,
  y,
  width,
  style,
}: {
  readonly origins: FrameOrigins | null
  readonly frame: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly style?: CSSProperties
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const offset = yearLabelOffsetOf(width, origin.width, origin.height)
  return <img alt="" src={`${IMG_TEXT_FRAMES}/${pad(frame)}.png`} style={{ ...pixel, ...style, left: x + offset.x, top: y + offset.y }} />
}

/** 0x6aff8(칸 x + 0x18, 칸 y + 3, …, num 0x14, 앵커 4) — `yearCellDrawingOf` 는 칸 왼쪽 기준이다 */
export function CellNumber({
  drawing,
  x,
  y,
  dx = 0,
}: {
  readonly drawing: ReturnType<typeof yearCellDrawingOf>
  readonly x: number
  readonly y: number
  readonly dx?: number
}) {
  return (
    <>
      {drawing.glyphs.map((glyph, index) => (
        <img key={index} alt="" src={`${NUM}/${pad(glyph.frame)}.png`} style={{ ...pixel, left: x + dx + glyph.x, top: y + 3 }} />
      ))}
      {drawing.dots.map((dot, index) => (
        <Rect key={`d${index}`} x={x + dx + dot.x} y={y + dot.y} width={1} height={2} color={ORIGINAL_COLORS.text} />
      ))}
    </>
  )
}

export function Rect({
  x,
  y,
  width,
  height,
  color,
  opacity = 1,
}: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
  readonly opacity?: number
}) {
  if (width <= 0 || height <= 0) return null
  return <span style={{ ...pixel, left: x, top: y, width, height, background: color, opacity }} />
}

export function CursorBox({ rowY, tick }: { readonly rowY: number; readonly tick: number }) {
  const box = cursorBoxOf(rowY, tick)
  return (
    <div data-testid="교체 커서">
      {roundEdgeRectsOf(box.x, box.y, box.width, box.height).map((rect, index) => (
        <Rect key={index} {...rect} color={box.color} opacity={box.opacity} />
      ))}
    </div>
  )
}
