// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import {
  ACE_PHASE, DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS,
} from '@/pages/general-mode/lib/generalModeSetup'
import { AceSelectScreen, acePlayerOfCell } from '@/pages/general-mode/ui/AceSelectScreen'

/** 마선수 고르기 (하위 상태 21, 목록 k = 2) — 윗줄 마투수 5 · 아랫줄 마타자 5 */

afterEach(cleanup)

type Props = Parameters<typeof AceSelectScreen>[0]

const 띄우기 = (overrides: Partial<Props> = {}) =>
  render(
    <AceSelectScreen
      phase={ACE_PHASE.마투수}
      openedAcePitcherIds={[0, 1, 2, 3, 4]}
      openedAceBatterIds={[0, 1, 2, 3, 4]}
      onSelect={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  )

/**
 * 격자 칸은 40px 정사각이다 — 아래 버튼들과 이것으로 갈린다.
 * (jest-dom 이 없어 `toBeDisabled` 대신 `.disabled` 를 직접 본다)
 */
const 칸들 = () =>
  screen
    .getAllByRole('button')
    .filter((button): button is HTMLButtonElement => button.style.width === '40px')

describe('격자', () => {
  it('10칸이다 — 윗줄 마투수 · 아랫줄 마타자', () => {
    띄우기()

    expect(칸들()).toHaveLength(10)
  })

  it('칸 번호는 윗줄이 마투수다 — 웹판 ACE_PLAYERS 는 타자가 앞이라 갈아 준다', () => {
    expect(acePlayerOfCell(0)).toBe(ACE_PLAYERS[5])
    expect(acePlayerOfCell(4)).toBe(ACE_PLAYERS[9])
    expect(acePlayerOfCell(5)).toBe(ACE_PLAYERS[0])
    expect(acePlayerOfCell(9)).toBe(ACE_PLAYERS[4])
  })
})

describe('마투수 단계', () => {
  it('윗줄만 고를 수 있다', () => {
    띄우기()
    const cells = 칸들()

    expect(cells[0].disabled).toBe(false)
    expect(cells[5].disabled).toBe(true)
  })

  it('고르면 격자 칸 번호를 넘긴다', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.click(칸들()[2])

    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('안 열린 마선수는 고를 수 없고 LOCK 으로 나온다', () => {
    띄우기({ openedAcePitcherIds: [0] })
    const cells = 칸들()

    expect(cells[0].disabled).toBe(false)
    expect(cells[1].disabled).toBe(true)
    expect(screen.getAllByRole('button', { name: 'LOCK' }).length).toBeGreaterThan(0)
  })
})

describe('마타자 단계', () => {
  it('아랫줄만 고를 수 있다', () => {
    띄우기({ phase: ACE_PHASE.마타자 })
    const cells = 칸들()

    expect(cells[0].disabled).toBe(true)
    expect(cells[7].disabled).toBe(false)
  })
})

describe('prop 을 안 넘기면(App.tsx 연결 누락 재현) 10칸이 전부 LOCK 이다', () => {
  it('openedAcePitcherIds·openedAceBatterIds 를 아예 안 주면 무엇도 못 고른다', () => {
    render(<AceSelectScreen phase={ACE_PHASE.마투수} onSelect={vi.fn()} onCancel={vi.fn()} />)
    const cells = 칸들()

    expect(cells.every((cell) => cell.disabled)).toBe(true)
    expect(screen.getAllByRole('button', { name: 'LOCK' })).toHaveLength(10)
  })
})

describe('App.tsx 기본 개방(DEFAULT_OPENED_ACE_*)을 넘기면', () => {
  it('마투수 로컬 0(싸이커)만 고를 수 있다', () => {
    띄우기({
      openedAcePitcherIds: DEFAULT_OPENED_ACE_PITCHER_IDS,
      openedAceBatterIds: DEFAULT_OPENED_ACE_BATTER_IDS,
    })
    const cells = 칸들()

    expect(cells[0].disabled).toBe(false)
    expect(cells[1].disabled).toBe(true)
    expect(cells[2].disabled).toBe(true)
    expect(cells[3].disabled).toBe(true)
    expect(cells[4].disabled).toBe(true)
  })

  it('마타자 로컬 0(메디카)만 고를 수 있다', () => {
    띄우기({
      phase: ACE_PHASE.마타자,
      openedAcePitcherIds: DEFAULT_OPENED_ACE_PITCHER_IDS,
      openedAceBatterIds: DEFAULT_OPENED_ACE_BATTER_IDS,
    })
    const cells = 칸들()

    expect(cells[5].disabled).toBe(false)
    expect(cells[6].disabled).toBe(true)
    expect(cells[7].disabled).toBe(true)
    expect(cells[8].disabled).toBe(true)
    expect(cells[9].disabled).toBe(true)
  })
})

/**
 * 잠긴 칸에서 OK 를 누르면 오픈 힌트 팝업이 뜬다 (0xa248 → 0xa68e~0xa6dc).
 * 힌트 글은 `XlsACE_LEVEL_UP` +0xc, 겉틀은 StrCOMMON[42]/[43] 이다.
 */
describe('오픈 힌트 팝업', () => {
  const 누르기 = (keys: string[]) => {
    for (const key of keys) fireEvent.keyDown(window, { key })
  }

  it('잠긴 칸에서 Enter 를 누르면 그 마선수의 힌트와 G 가격이 뜬다', () => {
    const { container } = 띄우기({ openedAcePitcherIds: [0] })

    // 칸 0(싸이커, 열림) → 칸 1(레오니, 잠김)
    누르기(['ArrowRight', 'Enter'])

    expect(container.textContent).toContain('삼진 삼진 삼진!!')
    expect(container.textContent).toContain('6000 G포인트')
  })

  it('드래고나(칸 4)는 G 로 못 여는 칸이라 "오픈할 수 없습니다" 다 — 0G 가 무료라는 뜻이 아니다', () => {
    const { container } = 띄우기({ openedAcePitcherIds: [0] })

    누르기(['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter'])

    expect(container.textContent).toContain('2010.gamevil.com')
    expect(container.textContent).toContain('오픈할 수 없습니다')
  })

  it('열린 칸에서는 팝업 대신 그 칸을 고른다', () => {
    const onSelect = vi.fn()
    const { container } = 띄우기({ openedAcePitcherIds: [0], onSelect })

    누르기(['Enter'])

    expect(onSelect).toHaveBeenCalledWith(0)
    expect(container.textContent).not.toContain('마선수 오픈 힌트')
  })

  it('다른 줄(지금 단계가 아닌 줄)의 잠긴 칸에서는 아무것도 안 뜬다', () => {
    const { container } = 띄우기({ openedAcePitcherIds: [0], openedAceBatterIds: [] })

    누르기(['ArrowDown', 'Enter'])

    expect(container.textContent).not.toContain('마선수 오픈 힌트')
  })
})

describe('이름 막대', () => {
  it('커서가 짚은 마선수 이름을 적는다', () => {
    띄우기()

    expect(screen.getByTestId('마선수-이름').textContent).toBe(ACE_PLAYERS[5].name)
  })

  it('레벨을 받으면 "이름 LV.n" 이 된다 (0xd2498)', () => {
    띄우기({ levels: { 0: 3 } })

    expect(screen.getByTestId('마선수-이름').textContent).toBe(`${ACE_PLAYERS[5].name} LV.3`)
  })

  it('잠긴 칸에서는 LOCK 이다', () => {
    띄우기({ openedAcePitcherIds: [] })

    expect(screen.getByTestId('마선수-이름').textContent).toBe('LOCK')
  })
})

describe('머리띠·바닥띠 (ScreenFrame)', () => {
  it('머리띠에 제목 8 "마선수선택" 그림이 뜬다 (P6 1-1)', () => {
    const { container } = 띄우기()

    expect(container.querySelector('img[src$="game_frame/008.png"]')).toBeTruthy()
  })

  it('바닥띠 되돌아가기가 여전히 눌린다 — 원본 소프트키 자리다', () => {
    const onCancel = vi.fn()
    띄우기({ onCancel })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onCancel).toHaveBeenCalled()
  })
})
