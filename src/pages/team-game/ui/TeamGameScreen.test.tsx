// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { DEFENSE_BACKGROUND_URL } from '@/pages/defense/lib/defenseView'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { SCENE_CONFIRM_READY_FRAMES, SCENE_PREPARE_FRAMES } from '@/features/play-game/model/useSceneConfirm'

/**
 * 경기 시작 인트로(상태 0xc)와 1회초 판(0x18) — 첫 사람 타석 앞에 서면 OK 로 넘긴다.
 * 둘 다 경기 화면(PixelScreen)을 통째로 덮으므로 '메뉴' 소프트키가 없다.
 */
const 판닫기 = () => {
  for (let 번 = 0; 번 < 2; 번 += 1) {
    if (screen.queryByRole('button', { name: '메뉴' }) !== null) return
    fireEvent.keyDown(window, { key: 'Enter' })
  }
}

/**
 * 상태 0xe — 새 타석마다 사람 OK 를 기다린다 (0x532b0). 들어선 뒤 세 갱신은 OK 를 안 받으니(0x49a26) 시계를 흘리고 누른다.
 * 기다리는 중이면 왼쪽 소프트키가 '확인' 이다.
 */
const OK통과 = () => {
  for (let 번 = 0; 번 < 3; 번 += 1) {
    if (screen.queryByRole('button', { name: '확인' }) === null) return
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: 'Enter' })
  }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

const 띄우기 = (options: Partial<TeamGameOptions> = {}, seed = 20100901) => {
  vi.useFakeTimers()
  const rendered = render(
    <TeamGameScreen
      options={{ ...기본옵션, ...options }}
      random={createSeededRandom(seed)}
      onFinish={vi.fn()}
      onQuit={vi.fn()}
    />,
  )
  판닫기()
  OK통과()
  return rendered
}

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

  it('코스 고르기에서 CLR 이면 구질 고르기로 돌아간다 (상태 0x10 → 0xf, 0x50ee6)', () => {
    띄우기()
    fireEvent.click(screen.getByText('FASTBALL'))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
    expect(screen.queryByText(/2\. 코스 선택/)).toBeNull()
  })

  it('게이지 설정이 꺼져 있으면 코스를 확정하는 순간 던진다 (원본 기본값)', () => {
    띄우기({}, 3) // 첫 공이 타구가 안 되는 씨앗 (경기 시작 rand(0, 2) 가 차례를 한 칸 민다)
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
      // 새 타자면 0xe 에서 OK 부터
      OK통과()
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

    // 제목 글자는 img_text 149 "타자" + 299 "교체" (S10 4절 — 규칙은 대타지만 화면 글자는 "타자 교체")
    expect(screen.getByText('타자 교체')).toBeTruthy()
    // 수비 쪽 제목은 안 뜬다
    expect(screen.queryByText('투수 교체')).toBeNull()
  })

  it('고른 마타자가 대타로 타석에 선다 (원본에서 마타자가 타석에 서는 유일한 길)', () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT, aceBatterId: 0 })
    fireEvent.keyDown(window, { key: '#' })
    fireEvent.click(screen.getByText('메디카 (마타자)'))

    expect(screen.queryByText('타자 교체')).toBeNull()
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
    판닫기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('자동진행'))

    expect(screen.getByText(/30 G포인트/)).toBeTruthy()
    fireEvent.click(screen.getByText('예'))

    expect(screen.getByText(/G포인트가 부족합니다/)).toBeTruthy()
    expect(onSpendGamePoint).not.toHaveBeenCalled()
  })

  it('G포인트가 넉넉하면 비용을 알리고 경기를 자동으로 소화한다', () => {
    vi.useFakeTimers()
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
    판닫기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('자동진행'))
    fireEvent.click(screen.getByText('예'))

    expect(onSpendGamePoint).toHaveBeenCalledWith(30)
    // 시즌 경기는 끝까지 소화된다 — 상태 0x18 경기 끝 결과 판(승·패·세 세 줄)이 먼저 뜬다
    expect(screen.getByAltText('승리투수')).toBeTruthy()
    // 처음 10틱은 OK 가 안 먹고(경기+0x32), 그 뒤 OK → 정산(0x19) 자리인 요약 화면
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByText('경기 결과')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 10))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('경기 결과')).toBeTruthy()
    vi.useRealTimers()
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
    판닫기()
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

  it("교체 창(상태 0xb)에서는 '*'·메뉴 소프트키가 안 먹는다 — 창이 그대로고 메뉴도 안 열린다 (0x498d4 '*' 는 0xd~0x15 만)", () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '# 교체' }))
    fireEvent.keyDown(window, { key: '*' })

    expect(screen.getByText('투수 교체')).toBeTruthy()
    expect(screen.queryByText('경기 중 메뉴')).toBeNull()
    const 메뉴 = screen.getByRole('button', { name: '메뉴' })
    expect((메뉴 as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(메뉴)
    expect(screen.getByText('투수 교체')).toBeTruthy()
    expect(screen.queryByText('경기 중 메뉴')).toBeNull()
    // 창을 닫으면(0x495fc 의 '#'·CLR) 다시 먹는다
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByText('경기 중 메뉴')).toBeTruthy()
  })

  it('우리 공격 차례에는 교체 입구가 없다 — 원본은 그 자리에서 대타를 연다', () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })

    expect(screen.queryByRole('button', { name: '# 교체' })).toBeNull()
  })
})

describe('경기 시작 인트로 (상태 0xc)', () => {
  it('시즌(모드 2)은 인트로가 54틱 서고 다 지나면 1회초 판으로 넘어간다', () => {
    vi.useFakeTimers()
    render(
      <TeamGameScreen options={기본옵션} random={createSeededRandom(20100901)} onFinish={vi.fn()} onQuit={vi.fn()} />,
    )
    expect(screen.getByText(/VS/)).toBeTruthy()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 53))
    expect(screen.queryByText(/VS/)).toBeTruthy()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.queryByText(/VS/)).toBeNull()
    // 1회초 판(0x18) — 판은 OK 를 기다린다
    expect(screen.getByText('1회초')).toBeTruthy()
    vi.useRealTimers()
  })

  it('대전(모드 8)은 0xc 를 안 지난다 — 인트로가 없다 (0x48b20)', () => {
    render(
      <TeamGameScreen
        options={{ ...기본옵션, mode: 8 }}
        random={createSeededRandom(20100901)}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
      />,
    )
    expect(screen.queryByText(/VS/)).toBeNull()
  })
})

describe('상태 0xe — 새 타석마다 사람 OK 를 기다린다 (0x39e14 → 0x532b0)', () => {
  const 판까지 = (options: Partial<TeamGameOptions> = {}) => {
    vi.useFakeTimers()
    render(
      <TeamGameScreen
        options={{ ...기본옵션, ...options }}
        random={createSeededRandom(20100901)}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
      />,
    )
    판닫기()
  }

  it('수비 차례: OK 전에는 구질 고르기가 없고, 들어선 뒤 세 갱신 안의 OK 는 안 먹는다 (0x49a26)', () => {
    판까지()
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
    // 시간 제한·자동 진행이 없다 (0x39bd4)
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
  })

  it("0xe 에서 '#' 교체 창이 열리고(0x4994a) 닫으면 다시 0xe — '*' 메뉴도 열리고 메뉴가 떠 있으면 OK 를 안 받는다", () => {
    판까지()
    // 0xd(두 그림)는 '#' 가 여는 상태 범위(0xe·0xf) 밖이다
    fireEvent.keyDown(window, { key: '#' })
    expect(screen.queryByText('투수 교체')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: '#' })
    expect(screen.getByText('투수 교체')).toBeTruthy()
    // 창이 떠 있으면 OK 를 안 받는다 — '#' 로 닫으면(0x495fc 취소) 곧장 0xe 에 다시 선다
    fireEvent.keyDown(window, { key: '#' })
    expect(screen.queryByText('투수 교체')).toBeNull()
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByText('경기 중 메뉴')).toBeTruthy()
    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
  })

  it('0xd 두 그림 뒤 0xe 에 들어서면 투수·타자 소개 판(0x44944)이 서고, OK 뒤에는 걷힌다 (0x4d9ec)', () => {
    판까지()
    expect(screen.queryByTestId('소개판')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_PREPARE_FRAMES))
    expect(screen.getByTestId('소개판')).toBeTruthy()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.queryByTestId('소개판')).toBeNull()
  })

  it('공격 차례도 같다 — 타석 장면은 서지만 OK 전에는 공이 안 나간다', () => {
    판까지({ playerSide: PLAYER_SIDE_FIRST_BAT })
    expect(screen.getByText('타석')).toBeTruthy()
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
    OK통과()
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
  })
})
