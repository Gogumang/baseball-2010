// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DerbyResultWindow } from '@/pages/home-run-derby/ui/DerbyResultWindow'
import { RETRY_QUESTION } from '@/pages/home-run-derby/lib/derbyResultLayout'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'

afterEach(cleanup)

const 결과 = (overrides: Partial<DerbyResult> = {}): DerbyResult => ({
  pitchCount: 12,
  maxCombo: 2,
  totalDistance: 640,
  bestDistance: 640,
  isNewRecord: true,
  gainedGamePoint: 215,
  ...overrides,
})

const 띄우기 = (result = 결과(), onRetry = vi.fn(), onExit = vi.fn()) => {
  render(<DerbyResultWindow result={result} heldGamePoint={1_234} onRetry={onRetry} onExit={onExit} />)
  return { onRetry, onExit }
}

describe('홈런더비 결과 화면 (0x45c18)', () => {
  it('"RESULT" 머리와 재도전 문구를 보여 준다', () => {
    띄우기()
    expect(screen.getByAltText('RESULT')).toBeTruthy()
    expect(screen.getByText(RETRY_QUESTION)).toBeTruthy()
  })

  it('예·아니오 두 단추가 있다', () => {
    띄우기()
    expect(screen.getByLabelText('예')).toBeTruthy()
    expect(screen.getByLabelText('아니오')).toBeTruthy()
  })

  it('처음 커서는 "예" 다 (scene+0x17f9 기본값)', () => {
    띄우기()
    expect(screen.getByLabelText('예').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('아니오').getAttribute('aria-pressed')).toBe('false')
  })

  it('예를 고르면 다시하기, 아니오를 고르면 나간다', () => {
    const { onRetry, onExit } = 띄우기()
    fireEvent.click(screen.getByLabelText('예'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('아니오'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('→ 로 커서를 옮기고 Enter 로 고른다', () => {
    const { onRetry, onExit } = 띄우기()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('취소 키는 아니오와 같은 길이다', () => {
    const { onExit } = 띄우기()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('신기록이면 알려 준다 (원본은 효과음 0x1f 로만 알린다)', () => {
    띄우기(결과({ isNewRecord: false }))
    expect(screen.queryByText('NEW RECORD!')).toBeNull()
    cleanup()
    띄우기(결과({ isNewRecord: true }))
    expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  })
})
