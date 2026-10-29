// @vitest-environment happy-dom
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { SeasonEndingScreen } from '@/pages/season/ui/SeasonEndingScreen'
import { SEASON_ENDING_TEXT, isSeasonEndingTextShown, seasonEndingIrisOf, seasonEndingTextIndexOf } from '@/widgets/season/lib/seasonEndingLayout'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'

/**
 * 시즌모드 엔딩 (0xf5 → 0x87a1c) — P6 4b 확정.
 * 글은 `StrENDING[15 + 결과]` 이고 자리는 **(0, H/2 + 55, 폭 W)** 다.
 */

afterEach(cleanup)

const 글 = () => document.body.textContent ?? ''

/** 글은 상태 틱 n > 15 부터 그린다 (0x87bdc~0x87be0) — 가짜 시계로 16 틀을 보낸다 */
function 글까지그리기(ui: React.ReactElement) {
  vi.useFakeTimers()
  try {
    render(ui)
    act(() => {
      vi.advanceTimersByTime(16 * millisecondsPerFrame())
    })
  } finally {
    vi.useRealTimers()
  }
}

describe('엔딩 글 StrENDING[15 + 결과]', () => {
  it('결과 0 은 [15] 비 인기 구단이다', () => {
    글까지그리기(<SeasonEndingScreen endingIndex={0} onFinish={vi.fn()} />)

    expect(seasonEndingTextIndexOf(0)).toBe(15)
    expect(글()).toContain('비 인기 구단')
  })

  it('결과 4 는 [19] 역사상 최고의 구단이다', () => {
    글까지그리기(<SeasonEndingScreen endingIndex={4} onFinish={vi.fn()} />)

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

  it('키 0x6b3c 는 키 값을 안 본다 — 어느 키든 화면 탭과 같다 (시즌 장면 0xe9ac 표 0xcbf6c[0xf5 − 0xc8] = 0xed60)', () => {
    vi.useFakeTimers()
    try {
      render(<SeasonEndingScreen endingIndex={2} onFinish={vi.fn()} />)
      // 진입 효과기(종류 2)가 도는 동안은 삼킨다
      act(() => {
        vi.advanceTimersByTime(12 * millisecondsPerFrame())
      })
      fireEvent.keyDown(window, { key: '3' })
      expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('6000 G포인트')
    } finally {
      vi.useRealTimers()
    }
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

  it('⚠️ 원본 버그 그대로 — 종류 1 이 끝을 세운 틀과 0x8bd8 이 그 끝을 보는 틀 사이의 키는 단계 2 를 만들어 영영 넘어가지 않는다 (6b52~6b6e · 8cdc)', () => {
    vi.useFakeTimers()
    try {
      const onFinish = vi.fn()
      render(<SeasonEndingScreen endingIndex={0} isBonusReceived onFinish={onFinish} />)
      // 진입의 종류 2 를 다 보낸다
      act(() => {
        vi.advanceTimersByTime(12 * millisecondsPerFrame())
      })
      fireEvent.click(screen.getByRole('button', { name: '확인' }))
      // 종류 1 의 마지막 칠하기(단계 0 — 완전 검정, 끝을 세운 틀)까지 한 틀씩
      const 덮개 = () => screen.queryByTestId('화면-효과기') as HTMLElement | null
      for (let frame = 0; frame < 20 && 덮개()?.style.opacity !== '1'; frame += 1) {
        act(() => {
          vi.advanceTimersByTime(millisecondsPerFrame())
        })
      }
      expect(덮개()?.style.opacity).toBe('1')
      expect(onFinish).not.toHaveBeenCalled()
      // 그 틀에 누른 키 — 효과기가 끝이라(+0x10 == 2) 키 받기가 막지 않는다 → 단계 2 · 종류 1 을 다시 건다
      fireEvent.click(screen.getByRole('button', { name: '확인' }))
      act(() => {
        vi.advanceTimersByTime(30 * millisecondsPerFrame())
      })
      expect(onFinish).not.toHaveBeenCalled()
      // 끝난 효과기는 비워져 화면이 다시 보이고, 그 뒤의 키도 단계만 올린다
      expect(덮개()).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '확인' }))
      act(() => {
        vi.advanceTimersByTime(30 * millisecondsPerFrame())
      })
      expect(onFinish).not.toHaveBeenCalled()
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
  it('배경은 외출 지도 0x7ea64(gfx, −1, 1) — 건물 다섯을 보통으로, 장소 이름은 숨긴다', () => {
    const { container } = render(<SeasonEndingScreen endingIndex={1} onFinish={vi.fn()} />)

    const map = screen.getByTestId('시즌-외출지도')
    expect(map.getAttribute('data-selected')).toBe('-1')
    expect(container.querySelectorAll('img[src*="map_label_"]').length).toBe(0)
  })

  it('원형 전환 판은 늘 있고, 상태 틱 n ≤ 10 에는 원을 안 그린다 (0x87a3c~0x87a42 `cmp #0xa; bgt`)', () => {
    render(<SeasonEndingScreen endingIndex={1} onFinish={vi.fn()} />)

    expect(screen.getByLabelText('원형 전환').querySelector('path')).toBeNull()
    expect(seasonEndingIrisOf(10)).toBeNull()
  })

  it('원은 0x87a1c 식 그대로 — D = 240 − 100, r = D − D·sin(k)/100 + D·sin(min(8t, 110))/100, 지름 W − r, 왼쪽 위 −(지름 − s) (A-19)', () => {
    // n = 11 → t = 0: k = sin 90 = 100, p = sin 0 = 0 → r = 0 → 지름 240, 왼쪽 위 (120 − 58 − 140, 160 − 55 − 140)
    expect(seasonEndingIrisOf(11)).toEqual({ x: -78, y: -35, diameter: 240 })
    // t ≥ 14 → 8t ≥ 110 이라 p = k → r = D → 지름 = s = 100, 왼쪽 위 (62, 105)
    expect(seasonEndingIrisOf(25)).toEqual({ x: 62, y: 105, diameter: 100 })
    expect(seasonEndingIrisOf(60)).toEqual({ x: 62, y: 105, diameter: 100 })
    // 옛 웹(사인 빠뜨림)처럼 한 번 줄었다 커지지 않는다 — t = 0 부터 줄어든다
    const 지름 = Array.from({ length: 15 }, (_, t) => seasonEndingIrisOf(11 + t)?.diameter ?? 0)
    expect(지름[1]).toBeLessThan(지름[0])
    expect(Math.min(...지름)).toBeLessThan(100) // t = 11·12 에 사인 99 로 조금 더 작아졌다 100 으로 돌아온다 — 원본 그대로
  })

  it('글은 상태 틱 n > 15 부터 (0x87bdc~0x87be0 `cmp #0xf; ble`)', () => {
    expect(isSeasonEndingTextShown(15)).toBe(false)
    expect(isSeasonEndingTextShown(16)).toBe(true)
    render(<SeasonEndingScreen endingIndex={1} onFinish={vi.fn()} />)
    expect(글()).not.toContain('지역 인기 구단')
  })
})
