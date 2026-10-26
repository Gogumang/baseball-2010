// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonItemShopScreen } from '@/pages/season/ui/SeasonItemShopScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'

/** 시즌 아이템 상점 0xdc 창 종류 2 (GP) — 0x81618 5 × 2 격자 10칸 */

afterEach(cleanup)

const 띄우기 = () => {
  const props = { onBuySubItem: vi.fn(() => ''), onBuyGpItem: vi.fn(() => ''), onBack: vi.fn() }
  render(<SeasonItemShopScreen kind={2} record={startNewSeason(0, '테스터').record} teamMorale={100} gamePoint={9999} {...props} />)
  return props
}

describe('GP 창 격자', () => {
  it('칸은 10개 — 칸 7~9 는 바탕만 있는 빈 칸이다 (아이콘 표 0xd4662 = −1)', () => {
    띄우기()
    // 칸 누름은 투명 누름 칸(role option) 10개 — 아이콘은 칸 0~6 에만 선다
    expect(screen.getAllByRole('option')).toHaveLength(10)
    expect(['빈 칸 7', '빈 칸 8', '빈 칸 9'].map((name) => screen.getByRole('option', { name }))).toHaveLength(3)
    expect(document.querySelectorAll('img[src*="item_icon"]')).toHaveLength(7)
  })

  it('빈 칸에도 커서가 선다 — 이름 · 설명은 비고, 확인해도 아무 창이 안 뜬다', () => {
    const props = 띄우기()
    // 칸 0 → ↓ 칸 5 → → 6 → → 7
    for (const key of ['ArrowDown', 'ArrowRight', 'ArrowRight']) fireEvent.keyDown(window, { key })
    expect(screen.getByRole('option', { name: '빈 칸 7' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('shop-description').textContent?.trim()).toBe('')
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(props.onBuyGpItem).not.toHaveBeenCalled()
  })
})

describe('G 부족 [65] 팝업 — 0x98fe 0xbbef9(this, 2, 2, 1)', () => {
  it('예/아니오 두 단추로 뜨고, 웹에는 G 충전 0xfa 가 없어 어느 답이든 닫기만 한다', () => {
    const props = { onBuySubItem: vi.fn(() => ''), onBuyGpItem: vi.fn(() => ''), onBack: vi.fn() }
    render(<SeasonItemShopScreen kind={2} record={startNewSeason(0, '테스터').record} teamMorale={50} gamePoint={0} {...props} />)
    fireEvent.keyDown(window, { key: '5' })
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('G포인트가 부족합니다')
    expect(screen.getByRole('button', { name: '예' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(props.onBuyGpItem).not.toHaveBeenCalled()
  })
})
