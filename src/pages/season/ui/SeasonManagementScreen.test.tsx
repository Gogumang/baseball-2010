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

/** 커맨드 줄 칸 이름 — 단추 이름이 칸 id 다 (바닥 되돌아가기가 끝에 붙는다) */
const 칸이름들 = () => screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))

describe('시즌 관리 메뉴 (상태 0xc9)', () => {
  it('StrHOWTO[18] 차례 그대로 6칸이 나온다', () => {
    render(<SeasonManagementScreen state={시즌()} onSelect={vi.fn()} onExit={vi.fn()} />)

    expect(칸이름들()).toEqual([
      '시즌정보', '구단관리', '트레이닝', '외출', '아이템', '다음경기', '되돌아가기',
    ])
  })

  it('커맨드 줄 0x7e418 — 시즌 표 0xd47f4 아이콘 · 0xd4800 이름표, 칸 자리는 0xd4740 계단형', () => {
    const { container } = render(<SeasonManagementScreen state={시즌()} onSelect={vi.fn()} onExit={vi.fn()} />)

    const 아이콘 = [...container.querySelectorAll('[data-testid="command-bar"] button img')].map((img) => img.getAttribute('src'))
    expect(아이콘).toEqual([
      './sprites/management/icon_selected_21.png', './sprites/mode_icon/022.png', './sprites/mode_icon/001.png',
      './sprites/mode_icon/003.png', './sprites/mode_icon/004.png', './sprites/mode_icon/005.png',
    ])
    const 이름표 = container.querySelector('[data-testid="command-bar"] > img:last-child')?.getAttribute('src')
    expect(이름표).toBe('./sprites/management/command_label_117.png')
  })

  it('엔딩을 본 시즌(SR+0x1bc)이면 트레이닝·외출·다음경기 칸이 꺼진다 (0x4efc)', () => {
    render(<SeasonManagementScreen state={시즌({ endingSeen: true })} onSelect={vi.fn()} onExit={vi.fn()} />)

    const 꺼짐 = (이름: string) => (screen.getByRole('button', { name: 이름 }) as HTMLButtonElement).disabled
    expect(['트레이닝', '외출', '다음경기', '아이템'].map(꺼짐)).toEqual([true, true, true, false])
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

  it('위·아래는 꺼진 칸을 건너뛴다 (0x6c444) — SR+4 면 칸 1 에서 ↓ 하면 2·3 을 넘어 아이템(4)', () => {
    const onCursorChange = vi.fn()
    render(
      <SeasonManagementScreen state={시즌({ acted: true })} onSelect={vi.fn()} onExit={vi.fn()}
        cursor={1} onCursorChange={onCursorChange} />,
    )
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(onCursorChange).toHaveBeenLastCalledWith(4)
  })

  it('엔딩을 본 시즌이면 칸 4 에서 ↓ 는 꺼진 5 를 넘어 0 으로 감싼다, 칸 4 에서 ↑ 는 2·3 을 넘어 1', () => {
    const onCursorChange = vi.fn()
    render(
      <SeasonManagementScreen state={시즌({ endingSeen: true })} onSelect={vi.fn()} onExit={vi.fn()}
        cursor={4} onCursorChange={onCursorChange} />,
    )
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(onCursorChange).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(onCursorChange).toHaveBeenLastCalledWith(1)
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

  it('상태판 0x7d34c 와 가운데 판 0x7f814(감독)를 깐다 — 연차·경기 수는 상태판 메시지줄이 그린다', () => {
    render(
      <SeasonManagementScreen state={시즌({ yearIndex: 2, games: 12 })} onSelect={vi.fn()} onExit={vi.fn()} />,
    )

    expect(screen.getByRole('group', { name: '상태판' })).toBeTruthy()
    expect(screen.getByTestId('가운데판')).toBeTruthy()
  })
})

describe('관리 메뉴 진입 알림 — CPU 트레이드 요청 StrMODE[203] (팝업 0x27)', () => {
  it('예·아니오로 답하고, 떠 있는 동안 메뉴 키는 안 먹는다', () => {
    const onAnswer = vi.fn()
    const onExit = vi.fn()
    render(
      <SeasonManagementScreen state={시즌()} onSelect={vi.fn()} onExit={onExit}
        alert={{ text: '!C[트윈스] 팀에서!N트레이드 요청이 왔습니다', onAnswer }} />,
    )

    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('트레이드 요청')
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(onAnswer).toHaveBeenCalledWith(false)
    expect(onExit).not.toHaveBeenCalled()
  })
})

describe('구단관리 하위 메뉴 (상태 0xce)', () => {
  it('네 칸이 차례대로 나온다', () => {
    render(<SeasonTeamMenuScreen state={시즌()} onSelect={vi.fn()} onBack={vi.fn()} />)

    expect(칸이름들()).toEqual(['구장관리', '트레이드', '선수영입', '코치채용', '되돌아가기'])
    // 부모 칸 구단관리(0xd47f4[1] = 22)가 주황으로 (6, 245) 쪽에 선다
    expect(document.querySelector('[data-testid="command-bar"] > img')?.getAttribute('src'))
      .toBe('./sprites/management/icon_selected_22.png')
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

  it('0x47d8 — SR+0x56 == 1 이면 트레이드 칸만 흑백으로 그리고, 키 0x4e40 은 막지 않는다', () => {
    const onSelect = vi.fn()
    render(<SeasonTeamMenuScreen state={시즌({ tradeUsed: 1 })} onSelect={onSelect} onBack={vi.fn()} />)

    const 아이콘필터 = (이름: string) => screen.getByRole('button', { name: 이름 }).querySelector('img')?.style.filter ?? ''
    expect(아이콘필터('트레이드')).toBe('grayscale(1)')
    expect(아이콘필터('구장관리')).toBe('')
    fireEvent.click(screen.getByRole('button', { name: '트레이드' }))
    expect(onSelect).toHaveBeenLastCalledWith('트레이드', SEASON_SCENE_STATE.트레이드)
  })

  it('SR+0x56 == 1 이면 위·아래가 트레이드 칸을 건너뛴다 (0x6c444) — 구장관리 ↓ 는 선수영입', () => {
    const onCursorChange = vi.fn()
    render(
      <SeasonTeamMenuScreen state={시즌({ tradeUsed: 1 })} onSelect={vi.fn()} onBack={vi.fn()}
        cursor={0} onCursorChange={onCursorChange} />,
    )
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(onCursorChange).toHaveBeenLastCalledWith(2)
  })

  it('SR+0x56 == 0 이면 다 켠 칸이다', () => {
    render(<SeasonTeamMenuScreen state={시즌({ tradeUsed: 0 })} onSelect={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: '트레이드' }).querySelector('img')?.style.filter ?? '').toBe('')
  })

  it('취소는 관리 메뉴로 되돌아간다', () => {
    const onBack = vi.fn()
    render(<SeasonTeamMenuScreen state={시즌()} onSelect={vi.fn()} onBack={onBack} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})

describe('메뉴 커서를 부르는 쪽이 든다 (메뉴 객체 this+0x70 · this+0x78 는 장면이 사는 동안 남는다)', () => {
  const 커서칸 = () => screen.getAllByRole('button').find((button) => button.getAttribute('aria-current') === 'true')

  it('관리 메뉴는 넘긴 커서 칸에서 서고, 옮기면 onCursorChange 로 알린다', () => {
    const onCursorChange = vi.fn()
    render(
      <SeasonManagementScreen state={시즌()} onSelect={vi.fn()} onExit={vi.fn()} cursor={1} onCursorChange={onCursorChange} />,
    )

    expect(커서칸()?.getAttribute('aria-label')).toBe('구단관리')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(onCursorChange).toHaveBeenCalledWith(2)
  })

  it('구단관리도 같다 — 칸 1 은 트레이드', () => {
    render(<SeasonTeamMenuScreen state={시즌()} onSelect={vi.fn()} onBack={vi.fn()} cursor={1} onCursorChange={vi.fn()} />)

    expect(커서칸()?.getAttribute('aria-label')).toBe('트레이드')
  })
})
