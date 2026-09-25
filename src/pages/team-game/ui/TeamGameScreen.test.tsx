// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { DEFENSE_BACKGROUND_URL } from '@/pages/defense/lib/defenseView'
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

describe('팀 경기 화면 — 인플레이 타구는 수비 화면으로 (상태 0x17)', () => {
  /**
   * 사람이 던진 공이 인플레이 타구가 되면 **투구 단계 대신 수비 화면**이 뜬다.
   * 원본도 그 순간 경기 장면이 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며 키를 읽는다.
   *
   * ⚠️ jsdom 에는 캔버스도 프레임 원점 JSON 도 없어 야수·공 그림은 확인할 수 없다 —
   * 구장 배경이 섰는지로 화면이 바뀐 것만 본다 (`DefensePlayback.test.tsx` 와 같은 한계).
   * 붙든 상태를 다시 푸는 쪽은 `useTeamGame.test.tsx` 가 본다.
   */
  it('던진 공이 타구가 되면 구질 고르기가 사라지고 수비 화면이 뜬다', () => {
    const { container } = 띄우기()

    // 타구가 날 때까지 같은 구질·코스로 던진다 (씨앗 20100901 은 여덟 번째 투구에서 난다)
    for (let pitch = 0; pitch < 200; pitch += 1) {
      if (screen.queryByText('1. 구질 선택') === null) break
      fireEvent.click(screen.getByText('FASTBALL'))
      fireEvent.click(screen.getAllByRole('button', { name: /[◎·]/ })[0])
    }

    expect(screen.queryByText('1. 구질 선택')).toBeNull()
    // 타석으로 넘어간 것이 아니다 — 수비 화면이다
    expect(screen.queryByText('타석')).toBeNull()
    expect(container.querySelector(`img[src="${DEFENSE_BACKGROUND_URL}"]`)).not.toBeNull()
  })
})

describe('팀 경기 화면 — 공격(타석) 차례', () => {
  it('선공이면 1회초가 우리 공격이라 타석이 뜬다', () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })

    expect(screen.getByText('타석')).toBeTruthy()
    // 안내줄은 타순 칸과 **명단에 선 타자 이름**을 적는다 (대타가 붙은 뒤로는 이름이 바뀐다)
    expect(screen.getByText(/1번 /)).toBeTruthy()
    // 같은 화면에 투구 단계가 함께 뜨지 않는다 — 공수는 번갈아 돈다
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
  })

  it("'#' 가 공격 중에는 **대타** 화면을 연다 (0x49598 의 공격 가지)", () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    fireEvent.keyDown(window, { key: '#' })

    expect(screen.getByText('대타 교체')).toBeTruthy()
    // 수비 쪽 제목은 안 뜬다
    expect(screen.queryByText('투수 교체')).toBeNull()
  })

  it('고른 마타자가 대타로 타석에 선다 (원본에서 마타자가 타석에 서는 유일한 길)', () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT, aceBatterId: 0 })
    fireEvent.keyDown(window, { key: '#' })
    fireEvent.click(screen.getByText('메디카 (마타자)'))

    expect(screen.queryByText('대타 교체')).toBeNull()
    expect(screen.getByText(/1번 메디카/)).toBeTruthy()
  })
})

describe('경기 중 메뉴 (표 0xcfcfc 행 0)', () => {
  it('다섯 칸이 원본 차례대로 뜬다 — 계속·자동진행·조작방법·설정·나가기', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect(screen.getByText('경기 중 메뉴')).toBeTruthy()
    for (const 칸 of ['계속', '자동진행', '조작방법', '설정', '나가기']) {
      expect(screen.getByText(칸)).toBeTruthy()
    }
  })

  it("'*' 키로도 메뉴가 열린다 (0x498d4 는 소프트키1 을 '*' 로 읽는다)", () => {
    띄우기()
    fireEvent.keyDown(window, { key: '*' })

    expect(screen.getByText('경기 중 메뉴')).toBeTruthy()
  })

  it('나가기를 고르면 StrGAME[0] 확인 문구가 뜬다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('나가기'))

    expect(screen.getByText(/메인메뉴로 나가시겠습니까/)).toBeTruthy()
    expect(screen.getByText('예')).toBeTruthy()
  })

  it('G포인트를 안 넘기면 자동진행 칸이 잠긴다 (비용을 검사할 수 없다)', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    const 자동진행 = screen.getByText('자동진행').closest('button')

    expect(자동진행?.disabled).toBe(true)
  })

  it('자동진행은 30 G 를 묻고, 모자라면 StrGAME[5] 알림만 뜬다 (0x3c7d8)', () => {
    const onSpendGamePoint = vi.fn()
    render(
      <TeamGameScreen
        options={기본옵션}
        random={createSeededRandom(20100901)}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
        gamePoint={10}
        onSpendGamePoint={onSpendGamePoint}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('자동진행'))

    expect(screen.getByText(/30 G포인트/)).toBeTruthy()
    fireEvent.click(screen.getByText('예'))

    expect(screen.getByText(/G포인트가 부족합니다/)).toBeTruthy()
    expect(onSpendGamePoint).not.toHaveBeenCalled()
  })

  it('G포인트가 넉넉하면 비용을 알리고 경기를 자동으로 소화한다', () => {
    const onSpendGamePoint = vi.fn()
    render(
      <TeamGameScreen
        options={기본옵션}
        random={createSeededRandom(20100901)}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
        gamePoint={500}
        onSpendGamePoint={onSpendGamePoint}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('자동진행'))
    fireEvent.click(screen.getByText('예'))

    expect(onSpendGamePoint).toHaveBeenCalledWith(30)
    // 시즌 경기는 끝까지 소화된다 — 결과 화면이 뜬다
    expect(screen.getByText('경기 결과')).toBeTruthy()
  })

  it('대전모드(8)는 100 G 다', () => {
    render(
      <TeamGameScreen
        options={{ ...기본옵션, mode: 8 }}
        random={createSeededRandom(20100901)}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
        gamePoint={500}
        onSpendGamePoint={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('자동진행'))

    expect(screen.getByText(/100 G포인트/)).toBeTruthy()
  })
})

describe('투수 교체 (#)', () => {
  it('우리 수비 차례면 # 교체 소프트키가 뜨고, 벤치 목록이 열린다 (상태 0xb)', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '# 교체' }))

    expect(screen.getByText('투수 교체')).toBeTruthy()
    expect(screen.getByText(/지금 투수 —/)).toBeTruthy()
  })

  it('우리 공격 차례에는 교체 입구가 없다 — 원본은 그 자리에서 대타를 연다', () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })

    expect(screen.queryByRole('button', { name: '# 교체' })).toBeNull()
  })
})
