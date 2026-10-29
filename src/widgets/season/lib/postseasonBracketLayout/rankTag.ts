import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { type Glyph, glyphsWidthOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { BracketBox } from '@/widgets/season/lib/postseasonBracketLayout/bracketBoxes'

/**
 * 순위 딱지 (직접 떴다, 0x854c8~0x85524 — k = 0..3 이 프레임 53 박스 4 + k):
 * ```
 * 854f4  0xb9e05(img_text 307 "위", 박스, 정렬 0x24, 0, 0, ox −6, 0, 0)
 *        → 0xb9d74: x = 박스x − 6 + (박스폭 − 9) (비트 0x4) · y = 박스y + ceil((15 − 10)/2) (비트 0x20, 0xb9db0~0xb9dc4)
 * 85522  0xba719(박스, 자간 0, 값 4 − k, 기준 0, [[this+0x13c]+8]+8 = num, 정렬 0x21, ox 8, oy 1, 0)
 *        → 0xba51c: x0 = 박스x + 8 · y0 = 박스y + 1 + ceil((15 − 10)/2) — 비트 0x1 은 아무도 안 봐 **왼쪽 붙임**이다
 * ```
 * 숫자 그림은 num **0~9**(기준 0 — 흰 테두리 8×10, '1' 만 4×10)다. [this+0x13c] 는 순위표 0x7f070 이 "%"(num 106)를 꺼내는
 * 같은 num 이다(0x7f35e). 예전 웹은 P6 의 "numBox(…, 33, 8)" 를 못 풀어 하늘색 숫자(90번대)로 두었다.
 */
export const RANK_UNIT = { folder: assetUrl('./sprites/img_text/frames'), frame: 307, width: 9, height: 10 } as const

/** "위" 의 ox (0x854ec `movs r3, #6; rsbs`) */
const RANK_UNIT_DX = -6

/** 숫자의 ox · oy (0x85508 · 0x8550e) */
const RANK_DIGIT_DX = 8

const RANK_DIGIT_DY = 1

/** num 0~9 의 높이 */
export const RANK_GLYPH_HEIGHT = 10

/** 순위 숫자 — num 프레임 0 + 숫자, 자간 0 (한 자리뿐이다: 1~4) */
export function rankGlyphsOf(rank: number): Glyph[] {
  return [...String(rank)].map((digit) => ({ frame: Number(digit), width: digit === '1' ? 4 : 8, spacing: 0 }))
}

/** "위" 그림 왼쪽 위 — 오른쪽 맞춤 ox −6, 세로 가운데(올림) */
export function rankUnitPositionOf(tag: BracketBox): { x: number; y: number } {
  const dy = tag.height - RANK_UNIT.height
  return {
    x: tag.x + RANK_UNIT_DX + tag.width - RANK_UNIT.width,
    y: tag.y + (dy >> 1) + (dy & 1),
  }
}

/** 숫자는 박스 x + 8 에서 왼쪽 붙임 — `SpriteNumber` 에 넘길 오른쪽 끝 */
export function rankDigitRightOf(tag: BracketBox, rank: number): number {
  return tag.x + RANK_DIGIT_DX + glyphsWidthOf(rankGlyphsOf(rank))
}

/** 숫자 세로 칸 — oy 1 을 더한 박스(`SpriteNumber` 가 올림 가운데를 한다) */
export function rankDigitBoxTopOf(tag: BracketBox): number {
  return tag.y + RANK_DIGIT_DY
}
