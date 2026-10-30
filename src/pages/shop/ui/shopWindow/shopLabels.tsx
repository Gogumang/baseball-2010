/** 아이템 창 머리 · 값 칸의 글 그림과 값 막대 (0x81ea2~0x82254) */
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { MODE_UI_FRAME, centeredLeftOf, centeredTopOf, valueBarPositionOf } from '@/pages/shop/lib/shopLayout'
import type { ShopBox } from '@/pages/shop/lib/shopLayout'
import { IMG_TEXT, MODE_UI, spriteSrc } from '@/pages/shop/ui/shopWindow/spriteFolders'
import * as styles from '@/pages/shop/ui/ShopWindow.css'

const originOf = (origins: FrameOrigins | null, frame: number) => origins?.[String(frame).padStart(3, '0')] ?? null

/** img_text 글 그림을 단색으로 찍는다 (효과 11) */
function TintedLabel({
  frame,
  left,
  top,
  color,
  width,
  height,
}: {
  frame: number
  left: number
  top: number
  color: string
  width: number
  height: number
}) {
  return (
    <div
      className={styles.tintedLabel}
      style={{
        // 효과 0xb 는 인자 색의 아래 16비트(565)를 찍는다 — `solidColorCss`
        left,
        top,
        width,
        height,
        background: solidColorCss(color),
        maskImage: spriteMaskImage(spriteSrc(IMG_TEXT, frame)),
        WebkitMaskImage: spriteMaskImage(spriteSrc(IMG_TEXT, frame)),
      }}
    />
  )
}

/** 박스 가운데에 놓는 글 (정렬 0x22) */
export function CenteredLabel({ frame, box, color, origins }: { frame: number; box: ShopBox; color: string; origins: FrameOrigins | null }) {
  const size = originOf(origins, frame)
  if (size === null) return null
  const left = centeredLeftOf(box, size.width)
  const top = centeredTopOf(box, size.height)
  return <TintedLabel frame={frame} left={left} top={top} color={color} width={size.width} height={size.height} />
}

/** 칸 왼쪽 · 세로 가운데에 붙는 글 (정렬 0x21) */
export function LeftLabel({
  frame,
  box,
  color,
  origins,
  ox = 0,
  oy = 0,
}: {
  frame: number
  box: ShopBox
  color: string
  origins: FrameOrigins | null
  ox?: number
  oy?: number
}) {
  const size = originOf(origins, frame)
  if (size === null) return null
  const top = centeredTopOf(box, size.height) + oy
  return <TintedLabel frame={frame} left={box.x + ox} top={top} color={color} width={size.width} height={size.height} />
}

/** 값 막대 프레임 52 — 정렬 0x11 · (ox, oy) 또는 0x14(오른쪽 위) */
export function ValueBar({
  box,
  align,
  origins,
  ox = 0,
  oy = 0,
}: {
  box: ShopBox
  align: 0x11 | 0x14
  origins: FrameOrigins | null
  ox?: number
  oy?: number
}) {
  const size = originOf(origins, MODE_UI_FRAME.valueBar)
  if (size === null) return null
  const { x, y } = valueBarPositionOf(box, align, size.width, ox, oy)
  return <img className={styles.layer} alt="" src={spriteSrc(MODE_UI, MODE_UI_FRAME.valueBar)} style={{ left: x, top: y }} />
}
