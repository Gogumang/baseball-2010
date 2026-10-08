// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { SeasonEndingScreen } from '@/pages/season/ui/SeasonEndingScreen'
import {
  ENDING_IRIS_STAGES, SEASON_ENDING_TEXT, endingIrisRadiusOf, seasonEndingTextIndexOf,
} from '@/widgets/season/lib/seasonEndingLayout'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'

/**
 * 시즌모드 엔딩 (0xf5 → 0x87a1c) — P6 4b 확정.
 * 글은 `StrENDING[15 + 결과]` 이고 자리는 **(0, H/2 + 55, 폭 W)** 다.
 */

afterEach(cleanup)

const 글 = () => document.body.textContent ?? ''

describe('엔딩 글 StrENDING[15 + 결과]', () => {
  it('결과 0 은 [15] 비 인기 구단이다', () => {
    render(<SeasonEndingScreen endingIndex={0} onFinish={vi.fn()} />)

    expect(seasonEndingTextIndexOf(0)).toBe(15)
    expect(글()).toContain('비 인기 구단')
  })

  it('결과 4 는 [19] 역사상 최고의 구단이다', () => {
    render(<SeasonEndingScreen endingIndex={4} onFinish={vi.fn()} />)

    expect(seasonEndingTextIndexOf(4)).toBe(19)
    expect(글()).toContain('역사상 최고의 구단')
  })

  it('다섯 줄 모두 StrENDING 에 있다 (15~19)', () => {
    for (let index = 0; index < 5; index += 1) {
      expect(ORIGINAL_ENDINGS[seasonEndingTextIndexOf(index)]).toBeTruthy()
    }
  })

  it('글 자리는 (0, H/2 + 55, 폭 240) 이다 — 확정값', () => {
    expect(SEASON_ENDING_TEXT).toEqual({ x: 0, y: 215, width: 240 })
  })
})

describe('엔딩 보너스 StrMODE[214] — 키 0x6b3c 는 SR+0x7b 만 본다', () => {
  it('결과 2 는 표값 6 × 1000 = 6000 G 다 — 팝업 0x2b 를 닫으면 onBonusReceived, 엔딩 화면으로 돌아온다', () => {
    const onFinish = vi.fn()
    const onBonusReceived = vi.fn()
    render(<SeasonEndingScreen endingIndex={2} onBonusReceived={onBonusReceived} onFinish={onFinish} />)

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('6000 G포인트')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onBonusReceived).toHaveBeenCalledTimes(1)
    // 닫는 것만으로는 넘어가지 않는다 — 다음 키가 SR+0x7b 가 선 0x6b3c 로 단계 1
    expect(onFinish).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
  })

  it('SR+0x7b 가 서 있으면(판정 0 은 진입 0x6be8 이 세운다) 알림 없이 넘긴다 — 효과기 종류 1 아홉 틀이 끝난 틀에 (6b52~6b6e · 8ccc~8d2c)', () => {
    vi.useFakeTimers()
    try {
      const onFinish = vi.fn()
      render(<SeasonEndingScreen endingIndex={0} isBonusReceived onFinish={onFinish} />)

      fireEvent.click(screen.getByRole('button', { name: '확인' }))

      expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
      expect(onFinish).not.toHaveBeenCalled()
      // 종류 1 은 16,14,…,0 을 칠하는 아홉 틀 — 8 틀째에는 아직이다
      act(() => {
        vi.advanceTimersByTime(8 * millisecondsPerFrame())
      })
      expect(onFinish).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(3 * millisecondsPerFrame())
      })
      expect(onFinish).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('효과기가 도는 동안은 키를 삼킨다 (0x4b18 · 0x4b34 — +4 ≠ 0 · +0x10 == 0)', () => {
    vi.useFakeTimers()
    try {
      const onKey = vi.fn()
      window.addEventListener('keydown', onKey)
      render(<SeasonEndingScreen endingIndex={1} onFinish={vi.fn()} />)
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(onKey).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(12 * millisecondsPerFrame())
      })
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(onKey).toHaveBeenCalledTimes(1)
      window.removeEventListener('keydown', onKey)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('연출', () => {
  it('원형 전환을 그린다 (0x87a1c 는 나리와 같은 식을 쓴다)', () => {
    render(<SeasonEndingScreen endingIndex={1} onFinish={vi.fn()} />)

    expect(screen.getByLabelText('원형 전환')).toBeDefined()
  })

  it('⚠️ 원본 버그 그대로 — 아이리스 반지름이 t=1 에서 t=0 보다 작아진다', () => {
    const D = ENDING_IRIS_STAGES.open.diameter // 140
    expect(endingIrisRadiusOf(0, D)).toBe(14) // 0.10·D
    expect(endingIrisRadiusOf(1, D)).toBe(8) // 0.06·D — 한 번 줄었다 다시 커진다
    expect(endingIrisRadiusOf(2, D)).toBeGreaterThan(endingIrisRadiusOf(1, D))
    // t ≥ 7 이면 p 가 110 에 걸려 r = D
    expect(endingIrisRadiusOf(7, D)).toBe(D)
    expect(endingIrisRadiusOf(20, D)).toBe(D)
  })
})
