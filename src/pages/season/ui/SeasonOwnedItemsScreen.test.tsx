// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonOwnedItemsScreen } from '@/pages/season/ui/SeasonOwnedItemsScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'

/** 시즌정보 → 아이템 0xd6 — 창 0x81dc0 종류 5 */

afterEach(cleanup)

const 띄우기 = () => render(<SeasonOwnedItemsScreen record={startNewSeason(0, '테스터').record} teamMorale={100} onBack={vi.fn()} />)

describe('보유 아이템 창 (종류 5)', () => {
  it('칸 바탕 0x7e764 를 10칸 모두에 깐다 (0x82420 — 가졌든 아니든)', () => {
    띄우기()
    expect(screen.getByTestId('shop-slot-cells').querySelectorAll('rect').length).toBeGreaterThanOrEqual(10 * 3)
  })

  it('격자 커서는 줄 안에서 감긴다 — 칸 0 에서 ← 는 칸 4, ↓ 는 칸 5 (목록 꼴 0x30)', () => {
    띄우기()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByRole('option', { name: '빈 칸 4' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: '빈 칸 9' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('option', { name: '빈 칸 5' }).getAttribute('aria-selected')).toBe('true')
  })
})
