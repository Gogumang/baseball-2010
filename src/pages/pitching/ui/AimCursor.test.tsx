// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { AimCursor } from '@/pages/pitching/ui/AimCursor'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'

afterEach(() => {
  cleanup()
  resetTouchKeyOffersForTest()
})

describe('조준(0x10) — 터치 CLR (r194)', () => {
  it('CLR 글자 자리가 없어 CLR 이 먹을 때(onCancel) \'구질로\' 상황 버튼(Escape)을 낸다', () => {
    render(<AimCursor side={0} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(touchKeyOffersNow()).toContainEqual({ key: 'Escape', label: '구질로' })
  })

  it('CLR 이 방향만 지우는 조준(onCancel 없음)에는 버튼이 없다', () => {
    render(<AimCursor side={0} onConfirm={vi.fn()} />)
    expect(touchKeyOffersNow().some((offer) => offer.key === 'Escape')).toBe(false)
  })
})
