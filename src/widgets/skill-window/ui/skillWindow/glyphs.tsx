/** 창 글자 그림 — img_text 가운데 맞춤 · num 흰 글자 · 칸 이름(그림자 + 글) */
import type { ReactNode } from 'react'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { SKILL_WINDOW_COLORS } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { LayoutBox } from '@/widgets/skill-window/lib/skillWindowLayout'
import * as styles from '@/widgets/skill-window/ui/SkillWindow.css'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const NUM = assetUrl('./sprites/num')
export const ITEM_ICON = assetUrl('./sprites/item_icon')

export const pad = (frame: number): string => String(frame).padStart(3, '0')

/** 물들인 그림 한 장 — 그림 모양 가면에 단색 */
function tintedGlyph(key: string, src: string, box: LayoutBox, tint: string): ReactNode {
  return (
    <div
      key={key}
      className={styles.tinted}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        background: solidColorCss(tint),
        maskImage: spriteMaskImage(src),
        WebkitMaskImage: spriteMaskImage(src),
      }}
    />
  )
}

/** 가운데 맞춤 자리 옮김 · 물들임 */
export interface TextFramePlacement {
  readonly dx?: number
  readonly dy?: number
  readonly tint?: string | null
}

const textFrameSizeOf = (textOrigins: FrameOrigins | null, frame: number) => textOrigins?.[pad(frame)] ?? null

/** img_text 프레임을 0xb9e05 로 — 가로 가운데는 내림, 세로 가운데는 올림 (0xb9d74) */
export function centeredTextFrameOf(
  textOrigins: FrameOrigins | null,
  frame: number,
  area: LayoutBox,
  { dx = 0, dy = 0, tint = null }: TextFramePlacement = {},
): ReactNode {
  const size = textFrameSizeOf(textOrigins, frame)
  if (size === null) return null
  const left = area.x + dx + Math.floor((area.width - size.width) / 2)
  const top = area.y + dy + Math.ceil((area.height - size.height) / 2)
  const src = `${IMG_TEXT}/${pad(frame)}.png`
  if (tint === null) return <img key={`t${frame}`} className={styles.layer} src={src} alt="" style={{ left, top }} />
  return tintedGlyph(`t${frame}`, src, { x: left, y: top, width: size.width, height: size.height }, tint)
}

/** num 그림 한 장을 효과 11 흰색으로 — 0xb9d35 (`key` 는 같은 그림이 두 번 나올 수 있어 따로 받는다) */
export function whiteGlyphOf(key: string, frame: number, box: LayoutBox): ReactNode {
  return tintedGlyph(key, `${NUM}/${pad(frame)}.png`, box, SKILL_WINDOW_COLORS.text)
}

/** 칸 안 이름 — 검정 그림자(+1,+1) 뒤 흰 글 */
export function cellLabelOf(key: string, text: string, area: LayoutBox): ReactNode[] {
  return [
    <div key={`${key}-s`} className={styles.textShadow} style={{ left: area.x + 1, top: area.y + 1, width: area.width, height: area.height }}>
      {text}
    </div>,
    <div key={`${key}-f`} className={styles.textFace} style={{ left: area.x, top: area.y, width: area.width, height: area.height }}>
      {text}
    </div>,
  ]
}
