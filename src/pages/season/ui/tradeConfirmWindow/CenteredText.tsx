import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { LINE_HEIGHT, measurePixelTextWidth } from '@/shared/lib/font/layout'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { yearLabelOffsetOf } from './otherSlices'
import { IMG_TEXT_FRAMES, pad, pixel, type Box } from './confirmAssets'

/** 0xb9e05 꼴 0x22 — 박스 가운데 */
export function CenteredImgText({ origins, frame, box }: { readonly origins: FrameOrigins | null; readonly frame: number; readonly box: Box }) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const dy = box.height - origin.height
  const offset = yearLabelOffsetOf(box.width, origin.width, origin.height)
  return (
    <img
      alt=""
      src={`${IMG_TEXT_FRAMES}/${pad(frame)}.png`}
      style={{ ...pixel, left: box.x + offset.x + origin.x, top: box.y + (dy >> 1) + (dy & 1) + origin.y }}
    />
  )
}

/**
 * 0xba411(박스, 글, 정렬 0x22) → 0xba2e4 (직접 떴다) — 한 줄 글을 박스 가운데.
 * 가로(정렬 0x2, 0xba342~0xba352): x += (w − 글폭(0x9c52d)) asr 1.
 * 세로(정렬 0x20, 0xba368~0xba396): d = h − 글꼴 높이(0x9baf0 = 글꼴 +0x6c = 11) → d > 0 이면 y += ceil(d/2), 아니면 y += d asr 1.
 */
/** 0xba2e4 의 세로 가운데(정렬 0x20) — 0xba37c~0xba396 */
function centeredTextDyOf(boxHeight: number): number {
  const d = boxHeight - LINE_HEIGHT
  return d > 0 ? (d >> 1) + (d % 2) : d >> 1
}

function segmentLeftsOf(segments: readonly { readonly text: string }[], start: number): readonly number[] {
  const lefts: number[] = []
  let x = start
  for (const segment of segments) {
    lefts.push(x)
    x += measurePixelTextWidth(segment.text) + 1
  }
  return lefts
}

export function CenteredMarkup({
  raw,
  box,
  color,
  testId,
}: {
  readonly raw: string
  readonly box: Box
  readonly color: string
  readonly testId?: string
}) {
  const segments = parseGameMarkup(raw).flatMap((line) => line.segments)
  const text = segments.map((segment) => segment.text).join('')
  const width = measurePixelTextWidth(text)
  const top = box.y + centeredTextDyOf(box.height)
  // 조각마다 왼쪽 끝 — 가운데 맞춘 시작에서 (앞 조각 폭 + 1) 씩 민다
  const lefts = segmentLeftsOf(segments, box.x + ((box.width - width) >> 1))
  return (
    <div data-testid={testId} aria-label={text}>
      {segments.map((segment, index) => (
        <PixelText key={index} style={{ ...pixel, left: lefts[index], top, color: segment.color ?? color }}>
          {segment.text}
        </PixelText>
      ))}
    </div>
  )
}

export function RoundBorder({
  x,
  y,
  width: w,
  height: h,
  color,
}: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}) {
  const line = (left: number, top: number, width: number, height: number) => (
    <span style={{ ...pixel, left, top, width, height, background: color }} />
  )
  return (
    <div data-testid="트레이드-비용-커서">
      {line(x + 1, y, w - 1, 1)}
      {line(x + 1, y + h, w - 1, 1)}
      {line(x, y + 1, 1, h - 1)}
      {line(x + w, y + 1, 1, h - 1)}
    </div>
  )
}
