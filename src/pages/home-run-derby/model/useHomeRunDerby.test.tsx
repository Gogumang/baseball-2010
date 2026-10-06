// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'

/** 홈런 결과 코드 하나 — `outcomeOfPattern` 의 마지막 갈래 */
const 홈런코드 = 24

const 홈런: PitchOutcomeDetail = {
  resolution: { kind: '타구', outcome: { kind: '홈런' } },
  hasSwung: true,
  isBunt: false,
  resultCode: 홈런코드,
  // 타석이 실제로 뽑은 패턴 한 장 (원본 표 24 번 묶음)
  pattern: [75, 1451, 1004, 0],
}

const 헛스윙: PitchOutcomeDetail = {
  resolution: { kind: '스트라이크', isSwinging: true },
  hasSwung: true,
  isBunt: false,
  resultCode: null,
}

/** 희생번트 타구 — 번트 판정(0x51226) 성공 코드 6 묶음 (`outcomeOfPattern` 의 case 6) */
const 번트: PitchOutcomeDetail = {
  resolution: { kind: '타구', outcome: { kind: '아웃', detail: '땅볼아웃' } },
  hasSwung: true,
  isBunt: true,
  resultCode: 7,
  pattern: [90, 300, 0, 0],
}

/** 공 하나를 치고 결과 연출이 끝날 때까지 시간을 흘린다 */
function 한구(rendered: { result: { current: ReturnType<typeof useHomeRunDerby> } }, detail: PitchOutcomeDetail) {
  act(() => rendered.result.current.onPitchResolved(detail))
  act(() => {
    vi.advanceTimersByTime(2_000)
  })
}

function 띄우기(bestDistance = 0, onFinish?: (result: DerbyResult) => void) {
  return renderHook(() => useHomeRunDerby({ bestDistance, onFinish }))
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

  it('번트 타구는 따로 다루지 않는다 — 0x17 끝 0xae3e8 의 "홈런 아닌 공" 하나: 기회 −1 · 비거리 그대로 · 콤보 끊김', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    한구(rendered, 홈런)
    expect(rendered.result.current.run.combo).toBe(1)
    const 누적 = rendered.result.current.run.totalDistance

    한구(rendered, 번트)

    const run = rendered.result.current.run
    expect(run.remainingPitches).toBe(7)
    expect(run.totalDistance).toBe(누적)
    expect(run.combo).toBe(0)
    expect(run.wasPreviousHomeRun).toBe(false)
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

  it('콤보 문구는 표시값 +0x84 를 본다 — 보너스를 여는 마지막 정규 공 홈런도 올린 콤보를 띄운다', () => {
    const rendered = 띄우기()
    for (let index = 0; index < 8; index += 1) 한구(rendered, 헛스윙)
    한구(rendered, 홈런)
    act(() => rendered.result.current.onPitchResolved(홈런))

    expect(rendered.result.current.run.combo).toBe(0)
    expect(rendered.result.current.run.isBonusGame).toBe(true)
    expect(rendered.result.current.banner).toContain('1 COMBO')
    expect(rendered.result.current.shownCombo).toBeNull()
  })

  it('보너스를 열어도 다음 공 준비(0xd → 0xe → OK → 0xf)를 지나 올린 콤보를 21 갱신 띄운다 (U-89 — 0x39e14 · 0x532b0 · 0x50c18 · 0x3dbf8)', () => {
    const rendered = 띄우기()
    for (let index = 0; index < 8; index += 1) 한구(rendered, 헛스윙)
    한구(rendered, 홈런)
    act(() => rendered.result.current.onPitchResolved(홈런))
    expect(rendered.result.current.run.isBonusGame).toBe(true)
    expect(rendered.result.current.shownCombo).toBeNull()
    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    expect(rendered.result.current.shownCombo).toBe(1)
    act(() => {
      vi.advanceTimersByTime(21 * 62)
    })
    expect(rendered.result.current.shownCombo).toBeNull()
    expect(rendered.result.current.run.comboDisplay).toBe(0)
  })

  it('HUD 콤보는 다음 공 준비(상태 0xf)에서 켜져 21 갱신 뒤 꺼지고 +0x84 를 지운다 (0x3dbf8 · 0x45a12)', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    act(() => rendered.result.current.onPitchResolved(홈런))
    // 결과 연출 동안은 아직 안 켜진다
    expect(rendered.result.current.shownCombo).toBeNull()
    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    expect(rendered.result.current.shownCombo).toBe(1)
    act(() => {
      vi.advanceTimersByTime(21 * 62)
    })
    expect(rendered.result.current.shownCombo).toBeNull()
    expect(rendered.result.current.run.comboDisplay).toBe(0)
    expect(rendered.result.current.run.combo).toBe(1)
  })

  it('다시하기는 판을 처음으로 되돌린다', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    act(() => rendered.result.current.restart())

    expect(rendered.result.current.run.remainingPitches).toBe(10)
    expect(rendered.result.current.run.totalDistance).toBe(0)
    expect(rendered.result.current.result).toBeNull()
  })

  it('이벤트 존은 친 공의 패턴 플래그 & 2 로만 정해진다 (플레이 +0x127, 0xb07c8)', () => {
    const rendered = 띄우기()
    act(() => rendered.result.current.onPitchResolved({ ...홈런, pattern: [118, 961, 1367, 2] }))
    expect(rendered.result.current.isEventZoneShown).toBe(true)
    expect(rendered.result.current.run.bonusGamePoint).toBe(200)
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    // 플래그 0 패턴(같은 홈런)은 존이 없다
    act(() => rendered.result.current.onPitchResolved(홈런))
    expect(rendered.result.current.isEventZoneShown).toBe(false)
  })

  it('단계가 오르면 마투수가 등판한다', () => {
    const rendered = 띄우기()
    expect(rendered.result.current.pitcher.ace).toBeNull()
    // 단계 0 은 구질 1 만 던진다
    expect(rendered.result.current.pitcher.pitchType).toBe(1)
  })
})

describe('경기 시작 굴림 — 0x39fdc 모드 7 갈래 3a454 rand(0, 9) 뒤 0xc0dac 의 rand(0, 2) (0x3f584 공통 꼬리)', () => {
  function 기록난수() {
    const calls: [number, number][] = []
    const random = {
      next: () => 0,
      nextInRange: (min: number, max: number) => {
        calls.push([min, max])
        return min
      },
      pick: <T,>(items: readonly T[]) => items[0],
    }
    return { random, calls }
  }

  it('들어서면 한 번 — 다시 그려도 더 굴리지 않는다', () => {
    const { random, calls } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    expect(calls).toEqual([[0, 9], [0, 2]])
    rendered.rerender()
    expect(calls).toEqual([[0, 9], [0, 2]])
  })

  it('다시하기도 새 장면이라 같은 둘을 또 굴린다', () => {
    const { random, calls } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    act(() => rendered.result.current.restart())
    expect(calls).toEqual([[0, 9], [0, 2], [0, 9], [0, 2]])
  })
})
