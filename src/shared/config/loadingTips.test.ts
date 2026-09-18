import { describe, expect, it } from 'vitest'
import { LOADING_TIPS, pickLoadingTip } from '@/shared/config/loadingTips'
import { ORIGINAL_TIPS } from '@/shared/config/original/tips'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

describe('로딩 팁 — 원본 StrTIP', () => {
  it('첫 항목은 개수(73)라 빼고, 그 수만큼의 팁을 쓴다', () => {
    expect(ORIGINAL_TIPS[0]).toBe('73')
    expect(LOADING_TIPS).toHaveLength(73)
    expect(LOADING_TIPS).not.toContain('73')
  })

  it('팁 목록 안에서 하나를 고른다', () => {
    const random = createSeededRandom(7)
    for (let draw = 0; draw < 20; draw += 1) {
      expect(LOADING_TIPS).toContain(pickLoadingTip(random))
    }
  })
})
