import { describe, expect, it } from 'vitest'
import { stepEnabledIndex } from '@/shared/ui/SelectBox/selectNavigation'

const 옵션 = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B', isDisabled: true },
  { value: 'c', label: 'C' },
]

describe('stepEnabledIndex', () => {
  it('비활성 옵션은 건너뛴다', () => {
    expect(stepEnabledIndex(옵션, 0, 1)).toBe(2)
    expect(stepEnabledIndex(옵션, 2, -1)).toBe(0)
  })

  it('끝에서는 반대편으로 돈다', () => {
    expect(stepEnabledIndex(옵션, 2, 1)).toBe(0)
  })

  it('전부 비활성이면 제자리다', () => {
    const 전부막힘 = 옵션.map((option) => ({ ...option, isDisabled: true }))
    expect(stepEnabledIndex(전부막힘, 1, 1)).toBe(1)
  })
})
