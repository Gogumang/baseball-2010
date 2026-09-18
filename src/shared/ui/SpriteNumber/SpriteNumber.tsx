import { GLYPH_SPACING, glyphsWidthOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'
import * as styles from '@/shared/ui/SpriteNumber/SpriteNumber.css'

const GLYPH_HEIGHT = 10
/** "/" 만 8px 이고 나머지는 10px 이다 */
const SHORT_GLYPH_FRAMES: ReadonlySet<number> = new Set([127])
const SHORT_GLYPH_HEIGHT = 8

interface SpriteNumberProps {
  readonly glyphs: readonly Glyph[]
  /** 오른쪽 끝 x */
  readonly right: number
  /** 세로 가운데를 맞출 칸 */
  readonly boxTop: number
  readonly boxHeight: number
  readonly folder?: string
  /** 글자 줄 높이. 기본 10px 이고, 순위표의 하늘색 숫자(num 90번대)처럼 다른 글자꼴이면 그 높이를 준다 */
  readonly glyphHeight?: number
}

/** num.pzx 숫자 그림을 오른쪽 정렬로 늘어놓는다 — 한 글자 전진 = 폭 + 1, 세로 가운데(ceil) */
export function SpriteNumber({
  glyphs, right, boxTop, boxHeight, folder = './sprites/num', glyphHeight = GLYPH_HEIGHT,
}: SpriteNumberProps) {
  const top = boxTop + Math.trunc((boxHeight - glyphHeight + 1) / 2)
  let x = right - glyphsWidthOf(glyphs)
  return (
    <>
      {glyphs.map((glyph, index) => {
        const left = x
        x += glyph.width + (glyph.spacing ?? GLYPH_SPACING)
        const height = SHORT_GLYPH_FRAMES.has(glyph.frame) ? SHORT_GLYPH_HEIGHT : glyphHeight
        return (
          <img
            key={index}
            className={styles.glyph}
            style={{ left, top: top + glyphHeight - height }}
            src={`${folder}/${String(glyph.frame).padStart(3, '0')}.png`}
            alt=""
          />
        )
      })}
    </>
  )
}
