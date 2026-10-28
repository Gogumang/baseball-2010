// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { PITCH_CHOICE_CELLS, PITCH_CHOICE_POPUP_HEIGHT, PITCH_CHOICE_TITLE_ID, PitchChoicePopup } from '@/pages/pitcher-league/ui/PitchChoicePopup'

afterEach(() => {
  cleanup()
  resetTouchKeyOffersForTest()
})

describe('투수 구질 두 갈래 팝업 0x78 (그리기 0x190f8 · 키 0x19398)', () => {
  it('판 · 칸 자리는 원본 값이다 — 높이 0x78 · 제목 StrMODE[59] · 칸 (W/2 − 0x38, H/2) 0x13 · (W/2 + 0x18, H/2) 0x12', () => {
    expect(PITCH_CHOICE_POPUP_HEIGHT).toBe(120)
    expect(PITCH_CHOICE_TITLE_ID).toBe(59)
    expect(PITCH_CHOICE_CELLS).toEqual([
      { x: 64, y: 160, iconFrame: 0x13, labelFrame: 308 },
      { x: 144, y: 160, iconFrame: 0x12, labelFrame: 309 },
    ])
  })

  it('확인 키는 상태를 먼저 바꾸고(0xbcb49) 창을 닫는다 — 취소는 상태를 안 바꾼다', () => {
    const calls: string[] = []
    const onChoose = vi.fn((index: number) => calls.push(`고름 ${index}`))
    const onClosed = vi.fn(() => calls.push('닫힘'))
    const { rerender } = render(<PitchChoicePopup selected={0} onMove={() => {}} onChoose={onChoose} onClosed={onClosed} />)
    fireEvent.keyDown(window, { key: '5' })
    expect(calls).toEqual(['고름 0', '닫힘'])

    rerender(<PitchChoicePopup key="둘째" selected={1} onMove={() => {}} onChoose={onChoose} onClosed={onClosed} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onClosed).toHaveBeenCalledTimes(2)
  })

  it('좌우 · 4 · 6 은 +0x166 을 뒤집는다 (193ae~193be)', () => {
    const onMove = vi.fn()
    render(<PitchChoicePopup selected={0} onMove={onMove} onChoose={() => {}} onClosed={() => {}} />)
    fireEvent.keyDown(window, { key: '6' })
    expect(onMove).toHaveBeenLastCalledWith(1)
    expect(screen.getByRole('button', { name: '마구' }).getAttribute('aria-pressed')).toBe('true')
  })

  it("창 그림 0x190f8 에 CLR 글자 자리가 없어 '취소' 상황 버튼(Escape)을 낸다 — 누르면 CLR 과 같이 상태를 안 바꾸고 닫는다 (r194)", () => {
    const onChoose = vi.fn()
    const onClosed = vi.fn()
    render(<PitchChoicePopup selected={0} onMove={() => {}} onChoose={onChoose} onClosed={onClosed} />)
    expect(touchKeyOffersNow()).toContainEqual({ key: 'Escape', label: '취소' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onChoose).not.toHaveBeenCalled()
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(touchKeyOffersNow().some((offer) => offer.key === 'Escape')).toBe(false)
  })
})
