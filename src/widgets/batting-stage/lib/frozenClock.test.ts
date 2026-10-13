import { describe, expect, it } from 'vitest'
import { frozenClockNowOf, observeFrozenClock, startFrozenClock } from '@/widgets/batting-stage/lib/frozenClock'

describe('결과 배경 시계 — 공용 창이 떠 있는 동안 선다 (0x52c50 52cc6 → 갱신 0x4b100 건너뜀)', () => {
  it('들어선 그림에 창이 뜨면 틱 0 에 멈췄다가, 닫힌 뒤부터 흐른다', () => {
    let clock = startFrozenClock(1000)
    clock = observeFrozenClock(clock, 1000, true)
    clock = observeFrozenClock(clock, 4000, true)
    expect(frozenClockNowOf(clock, 4000) - clock.startedAt).toBe(0)
    clock = observeFrozenClock(clock, 5000, false)
    expect(clock.startedAt).toBe(5000)
    expect(frozenClockNowOf(clock, 5600) - clock.startedAt).toBe(600)
  })

  it('창이 안 뜨면 그대로 흐른다', () => {
    const clock = observeFrozenClock(startFrozenClock(0), 300, false)
    expect(frozenClockNowOf(clock, 300) - clock.startedAt).toBe(300)
  })
})
