// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { SeasonEndingScreen } from '@/pages/season/ui/SeasonEndingScreen'

afterEach(() => {
  cleanup()
  setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG)
})

describe('B-34 10년차 엔딩에서 키를 누르면 영영 안 넘어감', () => {
  it('고침: 끝을 세운 틀에 키를 눌러도 단계 1 에 머물러 그 효과기의 끝이 넘긴다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-34']))
    vi.useFakeTimers()
    try {
      const onFinish = vi.fn()
      render(<SeasonEndingScreen endingIndex={0} isBonusReceived onFinish={onFinish} />)
      act(() => {
        vi.advanceTimersByTime(12 * millisecondsPerFrame())
      })
      fireEvent.click(screen.getByRole('button', { name: '확인' }))
      const 덮개 = () => screen.queryByTestId('화면-효과기') as HTMLElement | null
      for (let frame = 0; frame < 20 && 덮개()?.style.opacity !== '1'; frame += 1) {
        act(() => {
          vi.advanceTimersByTime(millisecondsPerFrame())
        })
      }
      expect(덮개()?.style.opacity).toBe('1')
      expect(onFinish).not.toHaveBeenCalled()
      // 원본은 이 키가 단계 2 를 만들어 영영 안 넘어간다 — 고친 길은 키를 버린다
      fireEvent.click(screen.getByRole('button', { name: '확인' }))
      act(() => {
        vi.advanceTimersByTime(30 * millisecondsPerFrame())
      })
      expect(onFinish).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
