import { describe, expect, it } from 'vitest'
import {
  RECORD_PICK_CELLS, recordPickIconOffsetOf, recordPickLabelXOf,
} from '@/widgets/record-pick-popup/lib/recordPickPopup'

describe('팝업 0x80 칸 그림 0x858fd (시즌 0xf334 · 나리 0x19448 · 0xb9c5c 꼴 0x22)', () => {
  it('칸은 (W/2 − 0x38, H/2) · (W/2 + 0x18, H/2) 32×32 — 프레임 6 · 10', () => {
    expect(RECORD_PICK_CELLS).toEqual([{ x: 64, y: 160, iconFrame: 6 }, { x: 144, y: 160, iconFrame: 10 }])
  })

  it('33×33 아이콘은 가로 몫 + 나머지로 −1, 세로 몫으로 0 — 칸 글은 (32 − 폭)/2 몫', () => {
    expect(recordPickIconOffsetOf(33, 33)).toEqual({ x: -1, y: 0 })
    expect(recordPickIconOffsetOf(29, 29)).toEqual({ x: 2, y: 1 })
    expect(recordPickLabelXOf(27)).toBe(2)
    expect(recordPickLabelXOf(36)).toBe(-2)
  })
})
