import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SPEED_LEVEL, setGameSpeedLevel } from '@/shared/config/frameRate'
import { appTickNow, appTickOf, appTickStartTime, createTickClock, resetAppTickClockForTest } from '@/shared/lib/frameClock/frameClock'

describe('틱 시계 — 시각을 틀 길이(millisecondsPerFrame) 격자의 정수 틱으로', () => {
  afterEach(() => {
    setGameSpeedLevel(DEFAULT_SPEED_LEVEL)
    resetAppTickClockForTest()
    vi.restoreAllMocks()
  })

  it('기본 속도(칸 2, 62ms)에서 틱 머리는 62 의 배수다 — 한 틱 안의 시각은 모두 같은 틱', () => {
    const clock = createTickClock()
    expect(clock.tickOf(0)).toBe(0)
    expect(clock.tickOf(61)).toBe(0)
    expect(clock.tickOf(62)).toBe(1)
    expect(clock.tickOf(1000)).toBe(16)
    expect(clock.startTimeOf(16)).toBe(992)
  })

  it('따로 켜진 부품도 같은 격자로 센다 — 켠 때가 틱 안쪽이어도 다음 틱 머리에서 함께 오른다', () => {
    const clock = createTickClock()
    // 하나는 틱 머리 바로 뒤(63), 하나는 틱 끝 바로 앞(123)에 켰다 — 둘 다 틱 1 에서 셈을 시작한다
    const startA = clock.tickOf(63)
    const startB = clock.tickOf(123)
    expect(startA).toBe(startB)
    // 124ms(틱 2 머리)에서 둘 다 1 이 된다 — 예전처럼 켠 시각에서 62ms 를 재면 A 는 125, B 는 185 에 올랐다
    expect(clock.tickOf(124) - startA).toBe(1)
    expect(clock.tickOf(124) - startB).toBe(1)
  })

  it('속도가 바뀌면 그때 든 틱의 머리부터 새 길이로 센다 — 틱이 거꾸로 가거나 건너뛰지 않는다', () => {
    const clock = createTickClock()
    expect(clock.tickOf(1000)).toBe(16) // 62ms × 16 = 992 가 틱 16 머리
    setGameSpeedLevel(0) // 250ms
    expect(clock.tickOf(1000)).toBe(16)
    expect(clock.startTimeOf(16)).toBe(992)
    expect(clock.tickOf(992 + 249)).toBe(16)
    expect(clock.tickOf(992 + 250)).toBe(17)
    setGameSpeedLevel(4) // 35ms
    expect(clock.tickOf(1242)).toBe(17)
    expect(clock.tickOf(1242 + 35)).toBe(18)
  })

  it('앱 틱은 performance.now() 를 같은 격자로 센다', () => {
    vi.spyOn(performance, 'now').mockReturnValue(130)
    expect(appTickNow()).toBe(2)
    expect(appTickOf(130)).toBe(2)
    expect(appTickStartTime(2)).toBe(124)
  })
})
