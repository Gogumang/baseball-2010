import { describe, expect, it } from 'vitest'
import { createKeyHold, HOLD_LONG_RELEASE_FLAG, HOLD_RELEASE_FLAG } from '@/shared/lib/sceneKeyLatch/keyHold'

describe('누른 채 되풀이 0xbca05 — 누른 틀 뒤 4틀마다 [+0x38]', () => {
  it('누른 틀 F 뒤 F+4 · F+8 에 되풀이, 단계 비트가 1 · 2 로 오른다', () => {
    const hold = createKeyHold()
    const 되풀이틀: number[] = []
    const 단계: number[] = []
    for (let frame = 0; frame <= 9; frame += 1) {
      const out = hold.frame(frame === 0 ? '6' : null, false)
      if (out.repeat !== null) {
        expect(out.repeat).toBe('6')
        되풀이틀.push(frame)
        단계.push(out.flags >> 4)
      }
    }
    expect(되풀이틀).toEqual([4, 8])
    expect(단계).toEqual([1, 2])
  })

  it('네 틀 안에 떼면 되풀이가 없다 · 단계가 선 뒤 떼면 길게 누른 뒤 뗌이 한 번 더 난다(bca9a)', () => {
    const 짧게 = createKeyHold()
    expect(짧게.frame('2', false).repeat).toBeNull()
    expect(짧게.frame(null, false).repeat).toBeNull()
    const 뗌 = 짧게.frame(null, true)
    expect(뗌.repeat).toBeNull()
    expect(뗌.flags).toBe(HOLD_RELEASE_FLAG)
    expect(짧게.frame(null, false).repeat).toBeNull()

    const 길게 = createKeyHold()
    길게.frame('2', false)
    for (let frame = 1; frame <= 4; frame += 1) 길게.frame(null, false)
    const 긴뗌 = 길게.frame(null, true)
    expect(긴뗌.repeat).toBe('2')
    expect(긴뗌.flags).toBe(HOLD_LONG_RELEASE_FLAG | HOLD_RELEASE_FLAG)
    for (let frame = 0; frame < 8; frame += 1) expect(길게.frame(null, false).repeat).toBeNull()
  })

  it('누르고 뗌이 한 틀에 오면 누르고 있지 않다', () => {
    const hold = createKeyHold()
    hold.frame('5', true)
    for (let frame = 0; frame < 8; frame += 1) expect(hold.frame(null, false).repeat).toBeNull()
  })
})
