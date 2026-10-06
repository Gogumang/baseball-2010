// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonInfoScreen } from '@/pages/season/ui/SeasonInfoScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_INFO_MENU } from '@/widgets/season/lib/seasonInfoMenu'

/**
 * 시즌정보(0xcd) — 관리 메뉴 칸 0 의 네 칸 하위 메뉴. 칸 차례는 키 0x9008, 칸 글은 커맨드 줄 표 0xd47ec 의 img_text
 * 283 · 94 · 90 · 111 이 근거다.
 */

afterEach(cleanup)

const 시즌 = () => startNewSeason(0, '테스터')

describe('시즌정보 (상태 0xcd)', () => {
  it('칸 넷 — 구단정보 · 아이템 · 선수정보 · 기록순위', () => {
    render(<SeasonInfoScreen state={시즌()} onSelect={vi.fn()} onBack={vi.fn()} />)

    const 글들 = screen.getAllByRole('button').map((button) => (button.textContent ?? '').replace('▶', '').trim())
    expect(글들).toEqual(['구단정보', '아이템', '선수정보', '기록순위', '되돌아가기'])
    expect(SEASON_INFO_MENU.map((entry) => entry.textFrame)).toEqual([283, 94, 90, 111])
    expect(SEASON_INFO_MENU.map((entry) => entry.iconFrame)).toEqual([23, 8, 9, 10])
  })

  it('0x9008 — 칸 0 → 0xd5 · 칸 1 → 0xd6 · 칸 2 → 선수 고르기(this+0x110 = 2) · 칸 3 → 기록순위 창', () => {
    expect(SEASON_INFO_MENU.map((entry) => entry.action)).toEqual([
      { kind: '상태', target: SEASON_SCENE_STATE.구단정보 },
      { kind: '상태', target: SEASON_SCENE_STATE.보유아이템 },
      { kind: '선수고르기' },
      { kind: '기록순위창' },
    ])
    expect([SEASON_SCENE_STATE.구단정보, SEASON_SCENE_STATE.보유아이템, SEASON_SCENE_STATE.기록순위]).toEqual([0xd5, 0xd6, 0xdb])
  })

  it('확인은 고른 칸을 넘긴다', () => {
    const onSelect = vi.fn()
    render(<SeasonInfoScreen state={시즌()} onSelect={onSelect} onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '선수정보' }))

    expect(onSelect).toHaveBeenCalledWith(SEASON_INFO_MENU[2], 2)
  })

  it('커서를 부르는 쪽이 들면 그 칸에서 확인한다 (메뉴 객체 this+0x74 는 장면이 사는 동안 남는다)', () => {
    const onSelect = vi.fn()
    render(<SeasonInfoScreen state={시즌()} onSelect={onSelect} onBack={vi.fn()} cursor={3} onCursorChange={vi.fn()} />)

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(SEASON_INFO_MENU[3], 3)
  })

  it('취소(−16) 는 관리 메뉴로 돌아간다', () => {
    const onBack = vi.fn()
    render(<SeasonInfoScreen state={시즌()} onSelect={vi.fn()} onBack={onBack} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})
