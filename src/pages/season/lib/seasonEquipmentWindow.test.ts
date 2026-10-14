import { describe, expect, it } from 'vitest'
import fixture from '@/pages/season/lib/__fixtures__/tabPanel0x7c110.json'
import {
  descriptionBoxRectsOf, divisionsOf, effectOffsetsOf, equipmentDescriptionOf, equipmentEffectBonusOf, equipmentItemNameOf,
  equipmentPriceTenThousandsOf, moveEquipmentLevel, moveEquipmentPart, partMarkerBoxOf, partSeparatorRectsOf,
  scrollThumbRectsOf, scrolledEquipmentTopOf, tabPanelRectsOf,
} from '@/pages/season/lib/seasonEquipmentWindow'
import type { WindowRect } from '@/pages/season/lib/seasonEquipmentWindow'

type Primitive = readonly (string | number)[]
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`

/** 에뮬레이터 기록(0x7c110 을 unicorn 으로 돌려 0xb9f75 · 0x6a905 · 0x6a8a9 · 0x6a9f1 호출을 받아 적었다)을 칠한 점 지도로 */
function rasterOfPrimitives(primitives: readonly Primitive[]): Map<string, string> {
  const map = new Map<string, string>()
  const put = (x: number, y: number, color: string) => map.set(`${x},${y}`, color)
  for (const [kind, ...rest] of primitives) {
    const v = rest as number[]
    if (kind === 'fillbox' || kind === 'fill') {
      for (let x = v[0]; x < v[0] + v[2]; x += 1) for (let y = v[1]; y < v[1] + v[3]; y += 1) put(x, y, hex(v[4]))
    } else if (kind === 'line') {
      for (let x = Math.min(v[0], v[2]); x <= Math.max(v[0], v[2]); x += 1) {
        for (let y = Math.min(v[1], v[3]); y <= Math.max(v[1], v[3]); y += 1) put(x, y, hex(v[4]))
      }
    } else if (kind === 'pixel') put(v[0], v[1], hex(v[2]))
  }
  return map
}

function rasterOfRects(rects: readonly WindowRect[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const rect of rects) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) map.set(`${x},${y}`, rect.color.toLowerCase())
    }
  }
  return map
}

describe('장비 창 0x83378 그림', () => {
  it.each([
    ['styled_18_176_203_90', { x: 18, y: 176, width: 203, height: 90 }, true],
    ['plain_18_176_203_90', { x: 18, y: 176, width: 203, height: 90 }, false],
    ['styled_10_100_150_60', { x: 10, y: 100, width: 150, height: 60 }, true],
  ] as const)('판 0x7c110 %s — 에뮬레이터로 받은 그리기와 점마다 같다', (key, box, isStyled) => {
    const expected = rasterOfPrimitives((fixture as Record<string, Primitive[]>)[key])
    expect(rasterOfRects(tabPanelRectsOf(box, isStyled))).toEqual(expected)
  })

  it('칸 사이 세로선 134 · 155 · 176 · 197 (164 ~ 175) · 설명 상자 귀', () => {
    const separators = partSeparatorRectsOf()
    expect(separators.map((rect) => rect.x)).toEqual([134, 135, 155, 156, 176, 177, 197, 198])
    expect(separators[0]).toMatchObject({ y: 164, height: 12 })
    const box = descriptionBoxRectsOf()
    expect(box.at(-1)).toMatchObject({ x: 28, y: 270, width: 94 })
  })

  it('부위 표시 칸 (136 + 21 × 부위, 164)', () => {
    expect(partMarkerBoxOf(1)).toMatchObject({ x: 157, y: 164, width: 19, height: 13 })
  })

  it('목록 — 1 열 × 11 줄 · 4 열 × 1 줄 모두 감고, 보이는 다섯 줄로 굴린다', () => {
    expect(moveEquipmentLevel(10, 1)).toBe(0)
    expect(moveEquipmentLevel(0, -1)).toBe(10)
    expect(moveEquipmentPart(3, 1)).toBe(0)
    expect(scrolledEquipmentTopOf(0, 5)).toBe(1)
    expect(scrolledEquipmentTopOf(6, 2)).toBe(2)
  })

  it('굴림 막대 — 11 칸이면 높이 34, 윗줄 2 면 자리 13', () => {
    const [track, white, blue] = scrollThumbRectsOf(2)
    expect(track).toMatchObject({ x: 207, y: 185, width: 7, height: 73 })
    expect(white).toMatchObject({ x: 208, y: 198, width: 5, height: 33 })
    expect(blue).toMatchObject({ x: 209, y: 199, width: 3, height: 31 })
  })

  it('가격 · 효과 · 설명 (에뮬레이터: 타자 부위 1 칸 2 → 14000 만원 · +70 · "인기도 150 이상")', () => {
    expect(equipmentPriceTenThousandsOf(true, 1, 2)).toBe(14000)
    expect(equipmentEffectBonusOf(2)).toBe(70)
    expect(divisionsOf(70)).toBe(1)
    expect(effectOffsetsOf(250)).toEqual({ label: -33, plus: -24 })
    expect(equipmentDescriptionOf(true, 1, 2, () => false)).toBe('인기도 150 이상')
    expect(equipmentDescriptionOf(true, 1, 0, () => false)).toBe('인기도 제한 없음')
  })

  it('히든 칸 — 잠기면 "????" · 힌트, 열리면 이름 · 설명 없음', () => {
    expect(equipmentItemNameOf(true, 1, 7, () => false)).toBe('????')
    expect(equipmentDescriptionOf(true, 1, 7, () => false)).toBe('한라산까지 홈런!')
    expect(equipmentDescriptionOf(false, 0, 8, () => false)).toBe('나는야!N모자 컬렉터')
    expect(equipmentItemNameOf(true, 1, 7, () => true)).not.toBe('????')
    expect(equipmentDescriptionOf(true, 1, 7, () => true)).toBeNull()
  })
})
