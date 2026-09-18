import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

describe('createSeededRandom', () => {
  it('같은 시드는 같은 수열을 낸다 — 밸런싱 테스트가 재현 가능해야 한다', () => {
    const first = createSeededRandom(20100901)
    const second = createSeededRandom(20100901)

    const firstSequence = Array.from({ length: 20 }, () => first.next())
    const secondSequence = Array.from({ length: 20 }, () => second.next())

    expect(firstSequence).toEqual(secondSequence)
  })

  it('다른 시드는 다른 수열을 낸다', () => {
    const first = createSeededRandom(1)
    const second = createSeededRandom(2)

    expect(first.next()).not.toBe(second.next())
  })

  it('next는 0 이상 1 미만을 돌려준다', () => {
    const random = createSeededRandom(7)

    for (let index = 0; index < 500; index += 1) {
      const value = random.next()
      expect(value, `value was: ${value}`).toBeGreaterThanOrEqual(0)
      expect(value, `value was: ${value}`).toBeLessThan(1)
    }
  })

  it('nextInRange는 지정한 구간 안의 값을 돌려준다', () => {
    const random = createSeededRandom(11)

    for (let index = 0; index < 200; index += 1) {
      const value = random.nextInRange(-1.5, 2.5)
      expect(value, `value was: ${value}`).toBeGreaterThanOrEqual(-1.5)
      expect(value, `value was: ${value}`).toBeLessThan(2.5)
    }
  })

  it('빈 후보 목록으로 pick하면 예외를 던진다', () => {
    const random = createSeededRandom(3)

    expect(() => random.pick([])).toThrow('후보가 비어 있습니다')
  })
})
