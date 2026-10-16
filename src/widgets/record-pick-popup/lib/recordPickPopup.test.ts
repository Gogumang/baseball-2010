import { describe, expect, it } from 'vitest'
import {
  RECORD_PICK_CELLS, RECORD_PICK_TITLE_X, measuredTitleCenterXOf, recordPickIconOffsetOf, recordPickLabelXOf,
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

describe('0xba269 폭 −1 제목 가운데 (0x6ef4c 6efb0 → 0x9c52c)', () => {
  it('날 글 전체를 잰다 — "!C" · "!N" 도 영문 두 자, 두 줄은 이어 잰다', () => {
    // 12 + 보고 20 + 6 + 싶은 20 + 6 + 기록을 30 + 12 + 선택해주세요 60 − 1 = 165 → 0x24 + 82
    expect(measuredTitleCenterXOf(RECORD_PICK_TITLE_X, '!C보고 싶은 기록을!N선택해주세요')).toBe(36 + 82)
    // 구질 고르기 "!C원하는 항목을 선택해주세요" = 143 → (W/2 − 0x46) + 71
    expect(measuredTitleCenterXOf(120 - 0x46, '!C원하는 항목을 선택해주세요')).toBe(50 + 71)
  })
})
