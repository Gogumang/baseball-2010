// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { RecordPickPopup } from '@/widgets/record-pick-popup/ui/RecordPickPopup'

afterEach(() => {
  cleanup()
  resetTouchKeyOffersForTest()
})

describe('두 칸 고르기 팝업 — 터치 CLR (r186: 늘 있던 뒤로 버튼을 걷었다)', () => {
  it('바닥띠 되돌아가기 표시 자리의 누름 칸이 CLR(Escape) 키와 같은 길로 취소한다', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <RecordPickPopup
        ariaLabel="기록"
        testIdPrefix="기록"
        selected={0}
        closeKind="바로"
        cells={[
          { label: '개인', labelFrame: 6 },
          { label: '순위', labelFrame: 10 },
        ]}
        onToggle={vi.fn()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    const back = screen.getByRole('button', { name: '취소' })
    expect(back.style.left).toBe('204px')
    expect(back.style.top).toBe('302px')
    fireEvent.click(back)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("창 그림 0x19448 에 CLR 글자 자리가 없어 '취소' 상황 버튼(Escape)을 낸다 — 닫히면 걷는다 (r194)", () => {
    const onCancel = vi.fn()
    render(
      <RecordPickPopup
        ariaLabel="기록"
        testIdPrefix="기록"
        selected={0}
        closeKind="바로"
        cells={[
          { label: '개인', labelFrame: 6 },
          { label: '순위', labelFrame: 10 },
        ]}
        onToggle={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )
    expect(touchKeyOffersNow()).toContainEqual({ key: 'Escape', label: '취소' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(touchKeyOffersNow().some((offer) => offer.key === 'Escape')).toBe(false)
  })
})
