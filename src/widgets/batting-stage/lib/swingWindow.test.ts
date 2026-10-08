import { describe, expect, it } from 'vitest'
import { keyTickOf } from '@/widgets/batting-stage/lib/swingWindow'

describe('키 틱 F — 보이던 공 틱 + 1 (키는 다음 그림에서, 0x3f378 의 +1 뒤에 읽힌다)', () => {
  it('릴리스 그림(공 틱 0)을 보고 누르면 F = 1', () => {
    expect(keyTickOf(0)).toBe(1)
    expect(keyTickOf(15)).toBe(16)
  })
})
