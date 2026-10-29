/** 엔트리 목록 창의 그림 조각 — 사각 칠 · img_text 가운데 · 흰 글 가운데 · num 숫자 가운데 · 커서 테두리 */
import type { CSSProperties } from 'react'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { IMG_TEXT_FRAMES, NUM, WHITE, pad, pixel } from '@/widgets/entry-editor/ui/entryListWindow/entryListAssets'
import { entryCursorBorderOf, type EntryRect } from '@/widgets/entry-editor/lib/entryListWindow'
import { yearLabelOffsetOf, yearNumberGlyphsOf } from '@/widgets/entry-editor/ui/entryListWindow/otherSlices'

export function Rect({
  x,
  y,
  width,
  height,
  color,
}: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}) {
  if (width <= 0 || height <= 0) return null
  return <span style={{ ...pixel, left: x, top: y, width, height, background: color }} />
}

/** 0x5650c · 0xb9d74 꼴 0x22 — (x, y, 폭, 15) 안 가운데 (박스 y − 2 · dy 2 / y − 1 · dy 1 은 결국 y) */
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
  return (
    <img
      alt=""
      src={`${IMG_TEXT_FRAMES}/${pad(frame)}.png`}
      style={{ ...pixel, ...style, left: x + offset.x + origin.x, top: y + offset.y + origin.y }}
    />
  )
}

/** "!C!cffffff…" 글상자 — 폭 안 가운데 · dy 2 */
export function CenteredText({ text, x, y, width }: { readonly text: string; readonly x: number; readonly y: number; readonly width: number }) {
  const textWidth = measurePixelTextWidth(text)
  return <PixelText style={{ ...pixel, left: x + ((width - textWidth) >> 1), top: y + 2, color: WHITE }}>{text}</PixelText>
}

/** 0xba51c(x, y + 3, 25, 15, 틈 0, 값, num 0x1e + 숫자, 꼴 2) — 가로 가운데 */
export function CenteredNumber({ value, x, y }: { readonly value: number; readonly x: number; readonly y: number }) {
  return (
    <>
      {yearNumberGlyphsOf(value).map((glyph, index) => (
        <img key={index} alt="" src={`${NUM}/${pad(glyph.frame)}.png`} style={{ ...pixel, left: x + glyph.x, top: y + 3 }} />
      ))}
    </>
  )
}

/** 커서 0x56234 — 깜빡이며 안팎으로 드나드는 테두리 */
export function CursorBorder({ rect, keyPresses }: { readonly rect: EntryRect; readonly keyPresses: number }) {
  const border = entryCursorBorderOf(rect, keyPresses)
  const { x, width: w, height: h } = border
  return (
    <div data-testid="엔트리-커서">
      <Rect x={x + 1} y={border.y} width={w - 1} height={1} color={border.color} />
      <Rect x={x + 1} y={border.y + h} width={w - 1} height={1} color={border.color} />
      <Rect x={x} y={border.y + 1} width={1} height={h - 1} color={border.color} />
      <Rect x={x + w} y={border.y + 1} width={1} height={h - 1} color={border.color} />
    </div>
  )
}
