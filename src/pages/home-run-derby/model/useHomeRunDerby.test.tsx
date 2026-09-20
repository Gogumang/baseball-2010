// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'

/** 홈런 결과 코드 하나 — `outcomeOfPattern` 의 마지막 갈래 */
const 홈런코드 = 24

const 홈런: PitchOutcomeDetail = {
  resolution: { kind: '타구', outcome: { kind: '홈런' } },
  hasSwung: true,
  isBunt: false,
  resultCode: 홈런코드,
}

const 헛스윙: PitchOutcomeDetail = {
  resolution: { kind: '스트라이크', isSwinging: true },
  hasSwung: true,
  isBunt: false,
  resultCode: null,
}

/** 공 하나를 치고 결과 연출이 끝날 때까지 시간을 흘린다 */
function 한구(rendered: { result: { current: ReturnType<typeof useHomeRunDerby> } }, detail: PitchOutcomeDetail) {
  act(() => rendered.result.current.onPitchResolved(detail))
  act(() => {
    vi.advanceTimersByTime(2_000)
  })
}

function 띄우기(bestDistance = 0, onFinish?: (result: DerbyResult) => void) {
  const random = createSeededRandom(5)
  return renderHook(() => useHomeRunDerby({ random, bestDistance, onFinish }))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('홈런더비 한 판', () => {
  it('공 하나마다 기회를 쓰고, 볼카운트는 없다', () => {
    const rendered = 띄우기()
    expect(rendered.result.current.run.remainingPitches).toBe(10)
    한구(rendered, 헛스윙)
    expect(rendered.result.current.run.remainingPitches).toBe(9)
  })

  it('홈런이면 비거리가 쌓이고, 아니면 안 쌓인다', () => {
    const rendered = 띄우기()
    한구(rendered, 헛스윙)
    expect(rendered.result.current.run.totalDistance).toBe(0)
    한구(rendered, 홈런)
    expect(rendered.result.current.run.totalDistance).toBeGreaterThan(0)
  })

  it('결과 연출 동안은 멈췄다가 다시 풀린다', () => {
    const rendered = 띄우기()
    act(() => rendered.result.current.onPitchResolved(헛스윙))
    expect(rendered.result.current.isPaused).toBe(true)
    expect(rendered.result.current.banner).not.toBe('')
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(rendered.result.current.isPaused).toBe(false)
    expect(rendered.result.current.banner).toBe('')
  })

  it('10구를 다 쓰면 결과가 나오고 onFinish 가 한 번 불린다 (콤보가 없을 때)', () => {
    const onFinish = vi.fn()
    const rendered = 띄우기(0, onFinish)
    for (let index = 0; index < 10; index += 1) 한구(rendered, 헛스윙)

    expect(rendered.result.current.run.isFinished).toBe(true)
    expect(rendered.result.current.result).not.toBeNull()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(rendered.result.current.result?.pitchCount).toBe(10)
  })

  it('연속 홈런으로 콤보가 생기면 보너스 게임으로 이어진다', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    한구(rendered, 홈런)
    expect(rendered.result.current.run.maxCombo).toBe(1)
    for (let index = 0; index < 8; index += 1) 한구(rendered, 헛스윙)

    expect(rendered.result.current.run.isBonusGame).toBe(true)
    expect(rendered.result.current.run.remainingPitches).toBe(1)
    expect(rendered.result.current.result).toBeNull()
  })

  it('다시하기는 판을 처음으로 되돌린다', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    act(() => rendered.result.current.restart())

    expect(rendered.result.current.run.remainingPitches).toBe(10)
    expect(rendered.result.current.run.totalDistance).toBe(0)
    expect(rendered.result.current.result).toBeNull()
  })

  it('단계가 오르면 마투수가 등판한다', () => {
    const rendered = 띄우기()
    expect(rendered.result.current.pitcher.ace).toBeNull()
    // 단계 0 은 구질 1 만 던진다
    expect(rendered.result.current.pitcher.pitchType).toBe(1)
  })
})
