import { describe, expect, it } from 'vitest'
import { movedSlotOf, slotGridKeyOf } from '@/pages/shop/lib/shopLayout'

describe('격자 커서 0x6bead — 목록 vt+0x1c(5, 2, 1, 꼴 0x30)', () => {
  it('←→ 는 같은 줄 안에서 감긴다 — 꼴 0x100 이 없어 줄을 넘지 않는다', () => {
    expect(movedSlotOf(4, '오른')).toBe(0)
    expect(movedSlotOf(0, '왼')).toBe(4)
    expect(movedSlotOf(9, '오른')).toBe(5)
    expect(movedSlotOf(5, '왼')).toBe(9)
    expect(movedSlotOf(2, '오른')).toBe(3)
  })

  it('↑↓ 는 같은 열 안에서 두 줄을 오간다', () => {
    expect(movedSlotOf(3, '아래')).toBe(8)
    expect(movedSlotOf(8, '아래')).toBe(3)
    expect(movedSlotOf(3, '위')).toBe(8)
    expect(movedSlotOf(9, '위')).toBe(4)
  })

  it('숫자키 꼴 1 — 2 ↑ · 4 ← · 6 → · 8 ↓ · 5 확인 (표 0xd2e7c)', () => {
    expect(['2', '4', '6', '8', '5', 'Enter', '0'].map(slotGridKeyOf)).toEqual(['위', '왼', '오른', '아래', '확인', '확인', null])
  })
})
