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

  it('신기록이어도 글자로는 안 알린다 — 0x45c18 은 st+0x3c 를 안 읽고, 효과음 0x1f 로만 알린다', () => {
    띄우기(결과({ isNewRecord: true }))
    expect(screen.queryByText(/NEW RECORD/i)).toBeNull()
  })

  it('값 숫자는 칸 (W/2 + 15, 줄 y, 42×12) 위에 붙여 오른쪽 맞춤, 자간 1 이다 (0xba51c 정렬 4)', () => {
    const { container } = render(
      <DerbyResultWindow result={결과({ pitchCount: 12 })} heldGamePoint={0} onRetry={vi.fn()} onExit={vi.fn()} />,
    )
    // 첫 줄 "12" — num 21(4px) · 22(6px), 오른끝 135 + 42 = 177 − (4+1) − (6+1) = 165, 위 = H/2 − 66 = 94
    const glyphs = [...container.querySelectorAll('img')].filter((node) => /num\/02[0-9]\.png$/.test(node.getAttribute('src') ?? ''))
    expect(glyphs.slice(0, 2).map((node) => [node.getAttribute('src'), node.style.left, node.style.top])).toEqual([
      ['./sprites/num/021.png', '165px', '94px'],
      ['./sprites/num/022.png', '170px', '94px'],
    ])
  })
})
