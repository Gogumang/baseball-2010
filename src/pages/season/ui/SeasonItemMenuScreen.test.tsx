// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonItemMenuScreen } from '@/pages/season/ui/SeasonItemMenuScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { ITEM_WINDOW_KIND, SEASON_ITEM_MENU } from '@/widgets/season/lib/seasonItemMenu'

/**
 * 시즌 아이템 하위 메뉴(0xd0) — 관리 메뉴 칸 4 에서 들어와 아이템 상점 0xdc 로 가는 길목이다.
 * 칸 넷과 차례는 키 0x4da4 · 0xdc 들어옴 0x5f3c 의 칸 → 창 종류 갈림이 근거다.
 */

afterEach(cleanup)

const 시즌 = () => startNewSeason(0, '테스터')

describe('시즌 아이템 메뉴 (상태 0xd0)', () => {
  it('칸 넷 — 0 장착아이템 · 1 구장아이템 · 2 서브아이템 · 3 GP아이템 (0x5f3c 의 창 종류 3·4·1·2)', () => {
    render(<SeasonItemMenuScreen state={시즌()} onSelect={vi.fn()} onBack={vi.fn()} />)

    const 글들 = screen.getAllByRole('button').map((button) => (button.textContent ?? '').replace('▶', '').trim())
    expect(글들).toEqual(['장착아이템', '구장아이템', '서브아이템', 'GP아이템', '되돌아가기'])
    expect(SEASON_ITEM_MENU.map((entry) => entry.windowKind)).toEqual([3, 4, 1, 2])
  })

  it('장비 칸은 선수 고르기(0xdf)로, 창 종류는 3(장비)이다', () => {
    const onSelect = vi.fn()
    render(<SeasonItemMenuScreen state={시즌()} onSelect={onSelect} onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '장착아이템' }))

    expect(onSelect).toHaveBeenCalledWith(
      SEASON_ITEM_MENU[0], SEASON_SCENE_STATE.선수고르기, ITEM_WINDOW_KIND.장비,
    )
  })

  it('GP아이템 칸은 아이템 상점(0xdc)으로, 창 종류는 2(GP)다', () => {
    const onSelect = vi.fn()
    render(<SeasonItemMenuScreen state={시즌()} onSelect={onSelect} onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'GP아이템' }))

    expect(onSelect).toHaveBeenCalledWith(
      SEASON_ITEM_MENU[3], SEASON_SCENE_STATE.아이템상점, ITEM_WINDOW_KIND.GP아이템,
    )
  })

  it('아이템 창 종류 번호는 [win+0x1a4] 그대로다 (1 서브 · 2 GP · 3 장비 · 4 구장)', () => {
    expect(ITEM_WINDOW_KIND).toEqual({ 서브아이템: 1, GP아이템: 2, 장비: 3, 구장아이템: 4 })
  })

  it('취소(−16) 는 관리 메뉴로 돌아간다', () => {
    const onBack = vi.fn()
    render(<SeasonItemMenuScreen state={시즌()} onSelect={vi.fn()} onBack={onBack} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})
