// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonManagementScreen } from '@/pages/season/ui/SeasonManagementScreen'
import { SeasonTeamMenuScreen } from '@/pages/season/ui/SeasonTeamMenuScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'

/**
 * 시즌 관리 메뉴(0xc9)·구단관리 하위 메뉴(0xce) — P4 1b 확정.
 * 6칸·4칸의 **차례**와 각 칸이 가는 **원본 장면 상태 번호**를 못박는다.
 */

afterEach(cleanup)

const 시즌 = (덮어쓰기: Partial<SeasonState['record']> = {}): SeasonState => {
  const state = startNewSeason(0, '테스터')
  return { ...state, record: { ...state.record, ...덮어쓰기 } }
}

/** 줄 글 — 커서 표시(▶)는 aria-hidden 이라 이름에서 빼고 본다 */
const 칸이름들 = () =>
  screen.getAllByRole('button').map((button) => (button.textContent ?? '').replace('▶', '').trim())

describe('시즌 관리 메뉴 (상태 0xc9)', () => {
  it('StrHOWTO[18] 차례 그대로 6칸이 나온다', () => {
    render(<SeasonManagementScreen state={시즌()} onSelect={vi.fn()} onExit={vi.fn()} />)

    expect(칸이름들()).toEqual([
      '시즌정보', '구단관리', '트레이닝', '외출', '아이템', '다음경기', '메인 메뉴',
    ])
  })

  it('칸마다 점프표 0xcbe40 이 가리키는 장면 상태로 간다', () => {
    const onSelect = vi.fn()
    render(<SeasonManagementScreen state={시즌()} onSelect={onSelect} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '다음경기' }))

    expect(onSelect).toHaveBeenCalledWith('다음경기', SEASON_SCENE_STATE.다음경기)
  })

  it('구단관리 칸은 0xce 로 간다', () => {
    const onSelect = vi.fn()
    render(<SeasonManagementScreen state={시즌()} onSelect={onSelect} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '구단관리' }))

    expect(onSelect).toHaveBeenCalledWith('구단관리', SEASON_SCENE_STATE.구단관리)
  })

  it('SR+4 가 서 있으면 트레이닝·외출 칸이 꺼진다 (갱신 0x4efc)', () => {
    const onSelect = vi.fn()
    render(<SeasonManagementScreen state={시즌({ acted: true })} onSelect={onSelect} onExit={vi.fn()} />)

    const 꺼짐 = (이름: string) =>
      (screen.getByRole('button', { name: 이름 }) as HTMLButtonElement).disabled
    expect(꺼짐('트레이닝')).toBe(true)
    expect(꺼짐('외출')).toBe(true)
    // 나머지 칸은 그대로 열려 있다
    expect(꺼짐('아이템')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '아이템' }))
    expect(onSelect).toHaveBeenCalledWith('아이템', SEASON_SCENE_STATE.아이템)
  })

  it('취소(−16)는 메인 메뉴 장면(0x103)으로 나간다', () => {
    const onExit = vi.fn()
    render(<SeasonManagementScreen state={시즌()} onSelect={vi.fn()} onExit={onExit} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onExit).toHaveBeenCalled()
  })

  it('↑↓ 로 커서를 옮기고 확인 키로 고른다 (−5 · "5")', () => {
    const onSelect = vi.fn()
    render(<SeasonManagementScreen state={시즌()} onSelect={onSelect} onExit={vi.fn()} />)

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: '5' })

    expect(onSelect).toHaveBeenCalledWith('구단관리', SEASON_SCENE_STATE.구단관리)
  })

  it('연차와 치른 경기 수를 보여 준다', () => {
    render(
      <SeasonManagementScreen state={시즌({ yearIndex: 2, games: 12 })} onSelect={vi.fn()} onExit={vi.fn()} />,
    )

    expect(screen.getByRole('group', { name: '관리 메뉴' }).textContent).toContain('3년차 12/45경기')
  })
})

describe('구단관리 하위 메뉴 (상태 0xce)', () => {
  it('네 칸이 차례대로 나온다', () => {
    render(<SeasonTeamMenuScreen state={시즌()} onSelect={vi.fn()} onBack={vi.fn()} />)

    expect(칸이름들()).toEqual(['구장관리', '트레이드', '선수영입', '코치채용', '되돌아가기'])
  })

  it('선수영입은 0xe2, 코치채용은 선수단 화면(0xd7)으로 간다', () => {
    const onSelect = vi.fn()
    render(<SeasonTeamMenuScreen state={시즌()} onSelect={onSelect} onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '선수영입' }))
    expect(onSelect).toHaveBeenLastCalledWith('선수영입', SEASON_SCENE_STATE.선수영입)

    fireEvent.click(screen.getByRole('button', { name: '코치채용' }))
    // 코치채용은 따로 상태가 없다 — 선수단 화면을 this+0x11c = 2 로 띄운다 (P4 1b)
    expect(onSelect).toHaveBeenLastCalledWith('코치채용', SEASON_SCENE_STATE.선수단)
  })

  it('취소는 관리 메뉴로 되돌아간다', () => {
    const onBack = vi.fn()
    render(<SeasonTeamMenuScreen state={시즌()} onSelect={vi.fn()} onBack={onBack} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})
