/** 장비 창의 자리 계산 — 줄 박스 · 탭 커서 · 프레임 정렬 · 효과 줄 ox */
import type { ShopBox } from '@/pages/shop/lib/shopLayout'
import { EQUIPMENT_BOXES, EQUIPMENT_TAB_STEP } from '@/pages/shop/lib/equipmentWindowLayout/equipmentConstants'

/** 박스를 줄 k 로 내린다 (y += k · (h + 2)) */
export const rowBoxOf = (base: ShopBox, row: number): ShopBox => ({ ...base, y: base.y + row * (base.height + 2) })

/** 부위 탭 커서 칸 — (박스0.x + 2 + (w + 2)·부위, 박스0.y, w, h) (0x8376a~0x83782) */
export const tabCursorBoxOf = (part: number): ShopBox => ({
  ...EQUIPMENT_BOXES.tab,
  x: EQUIPMENT_BOXES.tab.x + 2 + EQUIPMENT_TAB_STEP * part,
})

/**
 * 프레임 정렬 (0xb9e05 · 0xb9d35) — 가로 0x1 왼쪽 · 0x2 가운데(`(박스폭 − 폭) >> 1`) · 0x4 오른쪽,
 * 세로 0x10 위 · 0x20 가운데 · 0x40 아래. 0xb9e05 의 세로 가운데는 e = h − 높이 → `trunc(e/2) + e % 2`(올림),
 * 0xb9d35 는 내림(`trunc(e/2)`) 이다 (managementLayout · nationalCupLayout 과 같은 근거).
 */
export function alignedPositionOf(
  target: ShopBox,
  width: number,
  height: number,
  align: number,
  ox = 0,
  oy = 0,
  isRoundingDown = false,
): { readonly x: number; readonly y: number } {
  return {
    x: alignedLeftOf(target, width, align) + ox,
    y: alignedTopOf(target, height, align, isRoundingDown) + oy,
  }
}

/** 가로 정렬 — 0x4 오른쪽(남는 폭 전부) · 0x2 가운데(`>> 1`) · 그 밖 왼쪽 */
function alignedLeftOf(target: ShopBox, width: number, align: number): number {
  const spare = target.width - width
  if ((align & 0x4) !== 0) return target.x + spare
  if ((align & 0x2) !== 0) return target.x + (spare >> 1)
  return target.x
}

/** 세로 정렬 — 0x40 아래 · 0x20 가운데(0xb9e05 올림 · 0xb9d35 내림) · 그 밖 위 */
function alignedTopOf(target: ShopBox, height: number, align: number, isRoundingDown: boolean): number {
  const spare = target.height - height
  if ((align & 0x40) !== 0) return target.y + spare
  if ((align & 0x20) === 0) return target.y
  return target.y + (isRoundingDown ? Math.trunc(spare / 2) : Math.trunc(spare / 2) + (spare % 2))
}

/** 0x6c805(v, 10) — v 를 10 으로 몇 번 나눠야 0 이 되는지 − 1 (곧 자릿수 − 1) */
export function digitShiftOf(value: number): number {
  let count = 0
  let rest = Math.trunc(value / 10)
  while (rest !== 0) {
    count += 1
    rest = Math.trunc(rest / 10)
  }
  return count
}

/**
 * 효과 줄 (박스 2 줄 2, 0x83f48~0x8412a) — 보너스 b, d = `digitShiftOf(b)`:
 * ```
 * 능력치 이름  img_text (336|340 + 부위) 팔레트 1 · 0xb9e05 정렬 0x24 · ox −(7d + 19)
 * "+"          num 105 · 0xb9d35 정렬 0x24 · ox −(7d + 10) · oy 1
 * 숫자         0xba719(자간 1, b, 기준 20, num, 정렬 0x24, ox −2)
 * ```
 */
export function effectOffsetsOf(bonus: number): { readonly labelOx: number; readonly plusOx: number } {
  const shift = digitShiftOf(bonus)
  return { labelOx: -(shift * 7 + 19), plusOx: -(shift * 7 + 10) }
}
