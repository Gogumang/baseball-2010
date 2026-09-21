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
