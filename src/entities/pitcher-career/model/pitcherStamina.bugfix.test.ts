import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { consumeStamina } from '@/entities/pitcher-career/model/pitcherStamina'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-09 스태미나 0 에서 되살아남', () => {
  it('원본: 0 에서 한 개 더 던지면 100 (1%)', () => {
    expect(consumeStamina(0, 9, 600)).toBe(100)
  })

  it('고침: 0 에 머문다 — 0 보다 큰 값의 소모는 원본과 같다', () => {
    const before = consumeStamina(5000, 9, 600)
    setBugfixConfigForTests(bugfixConfigWith(['B-09']))
    expect(consumeStamina(0, 9, 600)).toBe(0)
    expect(consumeStamina(5000, 9, 600)).toBe(before)
  })
})
