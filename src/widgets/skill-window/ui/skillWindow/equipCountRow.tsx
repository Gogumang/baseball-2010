/** 장착 수 줄 (0x82c76~0x82e2c) — 박스 3 기준: 장착 수 / 상한 + "장착" 글 */
import type { ReactNode } from 'react'
import { DIGIT_BASE_FRAME, SLASH_FRAME } from '@/shared/lib/pixelNumber/pixelNumber'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { equippedPlusSkillCountOf, plusSkillSlotLimitOf } from '@/entities/career/model/playerCareer'
import { EQUIP_COUNT_LAYOUT, EQUIP_LABEL_FRAME, NAME_BOX } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { SkillWindowCareer } from '@/widgets/skill-window/model/skillWindowCareer'
import { centeredTextFrameOf, whiteGlyphOf } from '@/widgets/skill-window/ui/skillWindow/glyphs'

/** num 숫자 그림 높이 · '1' 과 나머지 숫자 폭 */
const DIGIT_HEIGHT = 10
const ONE_WIDTH = 4
const DIGIT_WIDTH = 6
/** "/" 는 5×8 */
const SLASH_SIZE = { width: 5, height: 8 } as const
/** 두 자리(10) */
const TEN = 10

const digitWidthOf = (digit: number): number => (digit === 1 ? ONE_WIDTH : DIGIT_WIDTH)

export function equipCountRowOf(career: SkillWindowCareer, textOrigins: FrameOrigins | null): ReactNode[] {
  const L = EQUIP_COUNT_LAYOUT
  const count = equippedPlusSkillCountOf(career)
  const limit = plusSkillSlotLimitOf(career)
  const digitTop = NAME_BOX.y + L.digitDy + Math.trunc((NAME_BOX.height - DIGIT_HEIGHT) / 2)
  const rightAligned = (dx: number, digit: number) => NAME_BOX.x + dx + NAME_BOX.width - digitWidthOf(digit)
  const glyph = (key: string, digit: number, x: number) =>
    whiteGlyphOf(key, DIGIT_BASE_FRAME + digit, { x, y: digitTop, width: digitWidthOf(digit), height: DIGIT_HEIGHT })
  const countParts =
    count === TEN
      ? [glyph('c1', 1, rightAligned(L.countTenOneDx, 1)), glyph('c0', 0, rightAligned(L.countRightDx, 0))]
      : [glyph('c', count, rightAligned(L.countRightDx, count))]
  // "/" 는 5×8 — 가로 가운데는 올림, 세로는 내림 (0xb9c5c)
  const slash = whiteGlyphOf('s', SLASH_FRAME, {
    x: NAME_BOX.x + L.slashDx + Math.ceil((NAME_BOX.width - SLASH_SIZE.width) / 2),
    y: NAME_BOX.y + L.digitDy + Math.trunc((NAME_BOX.height - SLASH_SIZE.height) / 2),
    ...SLASH_SIZE,
  })
  const limitParts =
    limit === TEN
      ? [glyph('l1', 1, NAME_BOX.x + L.limitDx), glyph('l0', 0, NAME_BOX.x + L.limitTenZeroDx)]
      : [glyph('l', limit, NAME_BOX.x + L.limitDx)]
  const shift = (count > 9 ? L.wideShift : 0) + (limit > 9 ? L.wideShift : 0)
  const label = centeredTextFrameOf(textOrigins, EQUIP_LABEL_FRAME, NAME_BOX, { dx: L.labelDx - shift, dy: L.labelDy })
  return [...countParts, slash, ...limitParts, label]
}
