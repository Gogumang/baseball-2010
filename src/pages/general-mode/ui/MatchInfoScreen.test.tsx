// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { INITIAL_SETUP } from '@/pages/general-mode/lib/generalModeSetup'
import { MatchInfoScreen } from '@/pages/general-mode/ui/MatchInfoScreen'

/** 경기정보 (하위 상태 22, 목록 k = 4) */

afterEach(cleanup)

type Props = Parameters<typeof MatchInfoScreen>[0]

const 기록 = { ...INITIAL_SETUP, userTeamId: 2, aiTeamId: 5, acePitcherId: 0, aceBatterId: 4 }

const 띄우기 = (overrides: Partial<Props> = {}) =>
  render(
    <MatchInfoScreen
      setup={기록}
      onStart={vi.fn()}
      onOpenSettings={vi.fn()}
      onRespin={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  )

describe('다섯 줄', () => {
  it('일반모드는 순위·승패가 "-" 다', () => {
    띄우기()

    expect(screen.getByTestId('경기정보-순위-유저').textContent).toBe('-')
    expect(screen.getByTestId('경기정보-승패-CPU').textContent).toBe('-')
  })

  it('선발은 두 팀 모두 투수 0번이다', () => {
    띄우기()

    expect(screen.getByTestId('경기정보-선발-유저').textContent).toBe(teamPitchers(2)[0].name)
    expect(screen.getByTestId('경기정보-선발-CPU').textContent).toBe(teamPitchers(5)[0].name)
  })

  it('고른 마투수·마타자를 유저 쪽에 적는다', () => {
    띄우기()

    expect(screen.getByTestId('경기정보-마투수-유저').textContent).toBe(ACE_PLAYERS[5].name)
    expect(screen.getByTestId('경기정보-마타자-유저').textContent).toBe(ACE_PLAYERS[4].name)
  })
})

describe('키', () => {
  it('OK 면 경기를 시작한다', () => {
    const onStart = vi.fn()
    띄우기({ onStart })

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onStart).toHaveBeenCalled()
  })

  it("'0' 이 경기진행 설정 창을 연다 — 일반모드에서만 여는 그 창이다", () => {
    const onOpenSettings = vi.fn()
    띄우기({ onOpenSettings })

    fireEvent.keyDown(window, { key: '0' })

    expect(onOpenSettings).toHaveBeenCalled()
  })

  it('CLR 은 되돌아간다', () => {
    const onCancel = vi.fn()
    띄우기({ onCancel })

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalled()
  })
})

describe('빠른실행 재선택', () => {
  it("빠른실행이 아니면 '*' 재선택이 없다", () => {
    const onRespin = vi.fn()
    띄우기({ onRespin })

    expect(screen.queryByRole('button', { name: '* 재선택' })).toBeNull()
    fireEvent.keyDown(window, { key: '*' })
    expect(onRespin).not.toHaveBeenCalled()
  })

  it("빠른실행이면 '*' 로 결정사항을 다시 굴린다", () => {
    const onRespin = vi.fn()
    띄우기({ isQuickStart: true, onRespin })

    fireEvent.click(screen.getByRole('button', { name: '* 재선택' }))

    expect(onRespin).toHaveBeenCalled()
  })
})

describe('머리띠·바닥띠 (ScreenFrame)', () => {
  it('머리띠에 제목 12 "경기정보" 그림이 뜬다 (P6 1-1)', () => {
    const { container } = 띄우기()

    expect(container.querySelector('img[src$="game_frame/012.png"]')).toBeTruthy()
  })

  it('바닥띠 되돌아가기가 여전히 눌린다 — 원본 소프트키 자리다', () => {
    const onCancel = vi.fn()
    띄우기({ onCancel })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it("'경기 시작' 과 '0 경기설정' 단추는 그대로 남는다", () => {
    const onStart = vi.fn()
    const onOpenSettings = vi.fn()
    띄우기({ onStart, onOpenSettings })

    fireEvent.click(screen.getByRole('button', { name: '경기 시작' }))
    fireEvent.click(screen.getByRole('button', { name: '0 경기설정' }))

    expect(onStart).toHaveBeenCalled()
    expect(onOpenSettings).toHaveBeenCalled()
  })
})
