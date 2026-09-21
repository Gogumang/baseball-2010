// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { TEAMS } from '@/shared/config/original/teams'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { GeneralModeScreen } from '@/pages/general-mode/ui/GeneralModeScreen'

/**
 * 일반모드 한 판 (하위 상태 18 → 19 → 20 → 21 → 22 → 경기 장면 0x104).
 * 팀 고르기 두 장은 나만의리그가 쓰던 `TeamSelectScreen` 을 그대로 빌려 쓴다.
 */

afterEach(cleanup)

type Props = Parameters<typeof GeneralModeScreen>[0]

const 띄우기 = (overrides: Partial<Props> = {}) =>
  render(
    <GeneralModeScreen
      random={createSeededRandom(20100901)}
      openedAcePitcherIds={[0, 1, 2, 3, 4]}
      openedAceBatterIds={[0, 1, 2, 3, 4]}
      onFinish={vi.fn()}
      onExit={vi.fn()}
      {...overrides}
    />,
  )

/** 격자 칸 하나 = 40px 정사각 */
const 칸들 = () => screen.getAllByRole('button').filter((button) => button.style.width === '40px')

describe('준비 흐름', () => {
  it('유저 팀 → AI 팀 → 선공 → 구장 → 마투수 → 마타자 → 경기정보 로 이어진다', () => {
    띄우기()

    // 18 유저 팀
    fireEvent.click(screen.getByRole('button', { name: TEAMS[2].name }))
    // 19 AI 팀
    fireEvent.click(screen.getByRole('button', { name: TEAMS[5].name }))
    // 20 단계 0 선공
    fireEvent.click(screen.getByRole('button', { name: '유저 선공' }))
    // 20 단계 1 구장
    fireEvent.click(screen.getByRole('button', { name: '이 구장으로' }))
    // 21 마투수 → 마타자
    fireEvent.click(칸들()[0])
    fireEvent.click(칸들()[5])

    // 22 경기정보 — 선발 줄이 두 팀 모두 차 있다
    expect(screen.getByTestId('경기정보-마투수-유저').textContent).toBe(ACE_PLAYERS[5].name)
    expect(screen.getByTestId('경기정보-마타자-유저').textContent).toBe(ACE_PLAYERS[0].name)
    expect(screen.getByRole('button', { name: '경기 시작' })).toBeTruthy()
  })

  it('첫 화면에서 CLR 하면 모드 목록으로 나간다', () => {
    const onExit = vi.fn()
    띄우기({ onExit })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onExit).toHaveBeenCalled()
  })

  it('AI 팀 화면에서 CLR 하면 유저 팀 화면으로 돌아간다 (나가지 않는다)', () => {
    const onExit = vi.fn()
    띄우기({ onExit })

    fireEvent.click(screen.getByRole('button', { name: TEAMS[2].name }))
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onExit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: TEAMS[2].name })).toBeTruthy()
  })

  it('히든 팀은 해금 기록을 넘기면 고를 수 있다 — 일반모드라서다', () => {
    띄우기({ openedHiddenTeamIds: [12] })

    expect(screen.getByRole('button', { name: TEAMS[12].name })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '???' })).toHaveLength(4)
  })
})

describe('빠른실행', () => {
  it('준비 단계를 건너뛰고 경기정보에서 시작한다', () => {
    띄우기({ isQuickStart: true })

    expect(screen.getByRole('button', { name: '경기 시작' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '* 재선택' })).toBeTruthy()
  })

  it('경기정보에서 CLR 하면 바로 모드 목록으로 나간다', () => {
    const onExit = vi.fn()
    띄우기({ isQuickStart: true, onExit })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onExit).toHaveBeenCalled()
  })
})

describe('경기 시작', () => {
  it('경기정보에서 OK 하면 팀 경기 화면으로 넘어간다', () => {
    띄우기({ isQuickStart: true })

    fireEvent.click(screen.getByRole('button', { name: '경기 시작' }))

    expect(screen.getByText('1회초')).toBeTruthy()
  })
})

describe('경기진행 설정', () => {
  it("경기정보의 '0' 으로 창을 열고 CLR 로 닫는다", () => {
    띄우기({ isQuickStart: true })

    fireEvent.click(screen.getByRole('button', { name: '0 경기설정' }))
    const 창 = screen.getByRole('dialog', { name: '경기진행 설정' })

    // 뒤쪽 경기정보 화면에도 같은 이름의 버튼이 있어 창 안에서만 찾는다
    fireEvent.click(within(창).getByRole('button', { name: '되돌아가기' }))
    expect(screen.queryByRole('dialog', { name: '경기진행 설정' })).toBeNull()
  })
})
