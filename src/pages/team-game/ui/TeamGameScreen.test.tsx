// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'

afterEach(cleanup)

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

const 띄우기 = (options: Partial<TeamGameOptions> = {}, seed = 20100901) =>
  render(
    <TeamGameScreen
      options={{ ...기본옵션, ...options }}
      random={createSeededRandom(seed)}
      onFinish={vi.fn()}
      onQuit={vi.fn()}
    />,
  )

describe('팀 경기 화면 — 수비(투구) 차례', () => {
  it('후공이면 1회초가 우리 수비라 구질 고르기가 뜬다 (상태 0xf)', () => {
    띄우기()

    expect(screen.getByText('1회초')).toBeTruthy()
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
  })

  it('구질을 고르면 코스 고르기로 넘어간다 (상태 0x10)', () => {
    띄우기()
    fireEvent.click(screen.getByText('FASTBALL'))

    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
  })

  it('게이지 설정이 꺼져 있으면 코스를 확정하는 순간 던진다 (원본 기본값)', () => {
    띄우기()
    fireEvent.click(screen.getByText('FASTBALL'))
    fireEvent.click(screen.getAllByRole('button', { name: /[◎·]/ })[0])

    // 다시 1단계로 돌아왔다 — 한 개를 던졌다는 뜻이다
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
  })

  it('게이지를 켜면 투구 결정 단계가 뜬다 (상태 0x11)', () => {
    띄우기({ gaugeSettingOn: true })
    fireEvent.click(screen.getByText('FASTBALL'))
    fireEvent.click(screen.getAllByRole('button', { name: /[◎·]/ })[0])

    expect(screen.getByText('3. 투구 결정')).toBeTruthy()
  })
})

describe('팀 경기 화면 — 공격(타석) 차례', () => {
  it('선공이면 1회초가 우리 공격이라 타석이 뜬다', () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })

    expect(screen.getByText('타석')).toBeTruthy()
    expect(screen.getByText(/1번 타자/)).toBeTruthy()
    // 같은 화면에 투구 단계가 함께 뜨지 않는다 — 공수는 번갈아 돈다
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
  })
})

describe('경기 중 메뉴', () => {
  it("'*' 메뉴의 나가기 확인 문구가 뜬다 (StrGAME[0])", () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect(screen.getByText(/메인메뉴로 나가시겠습니까/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '예' })).toBeTruthy()
  })
})
