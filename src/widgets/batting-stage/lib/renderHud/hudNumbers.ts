import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { type NumberGlyphPlacement, alignedNumberGlyphsOf } from '@/widgets/batting-stage/lib/renderHud/alignedNumberGlyphs'
import { sprite } from '@/widgets/batting-stage/lib/spriteLoader'

/**
 * 이닝 숫자 0xba689 → 0xba51c (0x373d0 의 378a2~378ea, 직접 떴다): 0x94a65(game_ui 프레임, 박스 0) = (9, 2, 10, 9) 에
 * (6, 6) 을 더해 x = 박스x + 6 + **박스w**, y = 박스y + 6 → (25, 8). 값 = st[+0x6b] + 1, 자간 0, 기준 0(num 000~), 정렬 4.
 * 0xba689 는 그대로 0xba51c(x, y, **w 0, h 0**, 자간, 값, 기준, 그림, 정렬, ox 0, oy 0, 0)로 넘긴다 (ba6a2~ba6ac) —
 * 상자 폭 0 에 오른쪽 맞춤이라 (25, 8) 이 오른끝, 글자는 아래 맞춤
 */
const INNING_BOX = { x: 15, y: 8, width: 10 }

const INNING_LETTER_SPACING = 0

const INNING_ALIGN = 0x4

const INNING_DIGITS_START = 0

/** HUD 이닝 숫자 자리 — 0xba689(25, 8, 자간 0, 이닝, 기준 0, num, 정렬 4) → 0xba51c (위 `INNING_BOX` 주석) */
export function inningGlyphsOf(
  inning: number,
  sizeOf: (index: number) => { readonly width: number; readonly height: number } | null,
): NumberGlyphPlacement[] | null {
  return alignedNumberGlyphsOf(
    inning,
    { x: INNING_BOX.x + INNING_BOX.width, y: INNING_BOX.y, width: 0, height: 0 },
    { spacing: INNING_LETTER_SPACING, start: INNING_DIGITS_START, align: INNING_ALIGN, offsetX: 0, offsetY: 0 },
    sizeOf,
  )
}

export const numGlyphUrl = (index: number) => assetUrl(`./sprites/num/${String(index).padStart(3, '0')}.png`)

export function numGlyphSizeOf(index: number): { readonly width: number; readonly height: number } | null {
  const image = sprite(numGlyphUrl(index))
  return image === null ? null : { width: image.width, height: image.height }
}
