// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  nextPopupClosingWidth, nextPopupOpeningHeight, popupBoxStyleOf, usePopupWindowMotion,
} from '@/shared/lib/commonWindow/popupWindow'

describe('nextPopupOpeningHeight — 0x75562~0x75586', () => {
  it('높이 0x78 은 6 → 12 → 24 → 48 → 96 → 다 펼침', () => {
    const heights: (number | null)[] = []
    let height: number | null = 6
    while (height !== null) {
      height = nextPopupOpeningHeight(height, 0x78)
      heights.push(height)
    }
    expect(heights).toEqual([12, 24, 48, 96, null])
  })

  it('두 배가 목표와 같으면 한 갱신 더 펼침이다 — 목표 < 두 배 일 때만 끈다', () => {
    expect(nextPopupOpeningHeight(48, 96)).toBe(96)
    expect(nextPopupOpeningHeight(96, 96)).toBeNull()
  })

  it('목표 0(판 없는 창 — 시즌 훈련 결과 · 경기 중 메뉴 · 이벤트 창)은 한 갱신 만에 끝난다', () => {
    expect(nextPopupOpeningHeight(6, 0)).toBeNull()
  })
})

describe('nextPopupClosingWidth — 0x75596~0x755ae', () => {
  it('240 → 120 → 닫힘(60 ≤ 99)', () => {
    expect(nextPopupClosingWidth(240)).toBe(120)
    expect(nextPopupClosingWidth(120)).toBeNull()
  })
})

describe('popupBoxStyleOf — 0x744c4 판은 가로 가운데로 준다', () => {
  it('폭 120 이면 왼쪽 60', () => {
    expect(popupBoxStyleOf({ openingHeight: null, closingWidth: 120 }, 100)).toEqual({ height: 100, left: 60, width: 120 })
  })
})

describe('usePopupWindowMotion', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const 틀 = (n: number) => act(() => { vi.advanceTimersByTime(millisecondsPerFrame() * n) })

  it('펼치는 동안은 키를 안 받는다 — 다 펼친 뒤에만 닫는다', () => {
    const { result } = renderHook(() => usePopupWindowMotion({ targetHeight: 100 }))
    expect(result.current.openingHeight).toBe(6)
    expect(result.current.close('바로')).toBe(false)
    틀(4)
    expect(result.current.openingHeight).toBe(96)
    expect(result.current.acceptsKeys()).toBe(false)
    틀(1)
    expect(result.current.openingHeight).toBeNull()
    expect(result.current.acceptsKeys()).toBe(true)
  })

  it("'바로' 는 그 자리에서 치운다 — 닫힘 애니 없음", () => {
    const onClosed = vi.fn()
    const { result } = renderHook(() => usePopupWindowMotion({ targetHeight: 100, skipsMotion: false }))
    틀(5)
    act(() => { result.current.close('바로', onClosed) })
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(result.current.isClosed).toBe(true)
    expect(result.current.acceptsKeys()).toBe(false)
  })

  it("'줄임' 은 다음 갱신 120, 그다음 갱신에 닫힌다 — 줄이는 동안 키를 안 받는다", () => {
    const onClosed = vi.fn()
    const { result } = renderHook(() => usePopupWindowMotion({ targetHeight: 100 }))
    틀(5)
    act(() => { result.current.close('줄임', onClosed) })
    expect(result.current.closingWidth).toBe(240)
    expect(result.current.close('줄임')).toBe(false)
    틀(1)
    expect(result.current.closingWidth).toBe(120)
    expect(onClosed).not.toHaveBeenCalled()
    틀(1)
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(result.current.isClosed).toBe(true)
  })

  it('[창+0x290] = 0(expands: false) — 첫 그림만 글을 안 그리고 키는 바로 받으며, 닫힘은 다음 갱신', () => {
    const onClosed = vi.fn()
    const { result } = renderHook(() => usePopupWindowMotion({ targetHeight: 0, expands: false }))
    expect(result.current.openingHeight).toBe(6)
    expect(result.current.acceptsKeys()).toBe(true)
    act(() => { result.current.close('줄임', onClosed) })
    expect(onClosed).not.toHaveBeenCalled()
    틀(1)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('onNextUpdate 는 키를 받은 다음 갱신(첫 줄임)에, onClosed 는 닫히는 갱신에 — 키 콜백이 0xbcb49 로 건 상태가 다음 틀에 선다', () => {
    const calls: string[] = []
    const { result } = renderHook(() => usePopupWindowMotion({ targetHeight: 100 }))
    틀(5)
    act(() => { result.current.close('줄임', () => calls.push('닫힘'), () => calls.push('다음갱신')) })
    expect(calls).toEqual([])
    틀(1)
    expect(calls).toEqual(['다음갱신'])
    틀(1)
    expect(calls).toEqual(['다음갱신', '닫힘'])
  })

  it('opensAtOnce — 첫 갈래 뒤 같은 갱신에 펼침을 마친 창은 처음부터 다 펼쳐져 있고 닫힘은 줄임이다', () => {
    const onClosed = vi.fn()
    const { result } = renderHook(() => usePopupWindowMotion({ targetHeight: 0, opensAtOnce: true }))
    expect(result.current.openingHeight).toBeNull()
    act(() => { result.current.close('줄임', onClosed) })
    틀(1)
    expect(result.current.closingWidth).toBe(120)
    틀(1)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('목표 0 인 창은 한 갱신만 펼침 — 그동안 키를 안 받는다', () => {
    const { result } = renderHook(() => usePopupWindowMotion({ targetHeight: 0 }))
    expect(result.current.acceptsKeys()).toBe(false)
    틀(1)
    expect(result.current.acceptsKeys()).toBe(true)
  })
})
