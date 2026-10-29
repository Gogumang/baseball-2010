import { GLYPH_SPACING, glyphsWidthOf } from '@/pages/management/lib/managementLayout'
import type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const NUM_FOLDER = assetUrl('./sprites/num')
/** num 20번대 숫자 높이 — 칸 높이와 같아 세로 어긋남이 없다 */
export const NUMBER_HEIGHT = 10

/** 글자마다 왼쪽 끝 — `start` 에서 (폭 + 자간) 씩 민다 */
function glyphLeftsOf(glyphs: readonly Glyph[], start: number): readonly number[] {
  const lefts: number[] = []
  let x = start
  for (const glyph of glyphs) {
    lefts.push(x)
    x += glyph.width + (glyph.spacing ?? GLYPH_SPACING)
  }
  return lefts
}

/**
 * 색 있는 숫자 — 0x7ba44 가 기본값 0xb6415(기록,k,0) 과 실효값 0xb570c 를 견줘 색을 정하고
 * (실효가 낮으면 (0xff,0,0) · 높으면 (0,0xff,0x40), 같으면 0), 레이더 0x5a990 은 **숫자에만** 그 색을 쓴다:
 * 0x5ad94 `ldr [색표 + k·4]` → 0 이 아니면 0x6aff8 에 [sp+0x18]=1·[sp+0x1c]=색 → 글자를 효과 0xb(단색)로 찍는다
 * (0x6b0fa~0x6b112 `movs r3,#0xb`, [sp]=색). 점·선·축 이름 상자는 색을 받지 않는다.
 */
export function TintedNumber({
  glyphs,
  right,
  top,
  color,
}: {
  readonly glyphs: readonly Glyph[]
  readonly right: number
  readonly top: number
  readonly color: string
}) {
  const lefts = glyphLeftsOf(glyphs, right - glyphsWidthOf(glyphs))
  return (
    <>
      {glyphs.map((glyph, index) => {
        const left = lefts[index]
        const src = `${NUM_FOLDER}/${String(glyph.frame).padStart(3, '0')}.png`
        return (
          <div
            key={index}
            className={styles.tintedGlyph}
            style={{
              left,
              top,
              width: glyph.width,
              height: NUMBER_HEIGHT,
              background: solidColorCss(color),
              maskImage: spriteMaskImage(src),
              WebkitMaskImage: spriteMaskImage(src),
            }}
          />
        )
      })}
    </>
  )
}
