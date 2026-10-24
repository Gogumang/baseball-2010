// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RecordPickPopup } from '@/widgets/record-pick-popup/ui/RecordPickPopup'

afterEach(cleanup)

describe('두 칸 고르기 팝업 — 터치 CLR (r186: 늘 있던 뒤로 버튼을 걷었다)', () => {
  it('바닥띠 되돌아가기 표시 자리의 누름 칸이 CLR(Escape) 키와 같은 길로 취소한다', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <RecordPickPopup ariaLabel="기록" testIdPrefix="기록" selected={0} closeKind="바로"
        cells={[{ label: '개인', labelFrame: 6 }, { label: '순위', labelFrame: 10 }]}
        onToggle={vi.fn()} onConfirm={onConfirm} onCancel={onCancel} />,
    )
    const back = screen.getByRole('button', { name: '취소' })
    expect(back.style.left).toBe('204px')
    expect(back.style.top).toBe('302px')
    fireEvent.click(back)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
