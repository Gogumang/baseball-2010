// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { createMemoryAutoRelayRecordPort, setAutoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'
import { DEFENSE_BACKGROUND_URL } from '@/pages/defense/lib/defenseView'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { SCENE_CONFIRM_READY_FRAMES, SCENE_PREPARE_FRAMES } from '@/features/play-game/model/useSceneConfirm'

/**
 * 경기 장면 0x104 의 로딩 판(상태 7 · 9 · 8 — 생성자 0x3301c 가 모드 갈래 없이 상태 7 을 예약한다) — 그림 대신 그리자마자 끝낸다
 * (적재를 다 그린 꼴). 받은 팁 · 진행 칸 끝을 남긴다
 */
const 로딩판 = vi.hoisted(() => [] as { tip: string; steps: number | undefined }[])
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async () => {
  const { useEffect, useEffectEvent } = await import('react')
  return {
    LoadingTip: ({ tip, steps, onDone }: { tip: string; steps?: number; onDone: () => void }) => {
      const finish = useEffectEvent(() => {
        로딩판.push({ tip, steps })
        onDone()
      })
      useEffect(() => finish(), [])
      return null
    },
  }
})

/**
 * 경기 시작 인트로(상태 0xc)와 1회초 판(0x18) — 첫 사람 타석 앞에 서면 OK 로 넘긴다.
 * 둘 다 경기 화면(PixelScreen)을 통째로 덮으므로 '메뉴' 소프트키가 없다.
 */
const 판닫기 = () => {
  for (let 번 = 0; 번 < 2; 번 += 1) {
    if (screen.queryByRole('button', { name: '메뉴' }) !== null) return
    fireEvent.keyDown(window, { key: 'Enter' })
    // 키는 받은 다음 틀의 키 자리에서 처리된다(`sceneKeyLatch`)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
  }
}

/** 한 틀 — 받은 키('*' · OK …)는 다음 틀의 키 0x498d4 가 처리한다(`sceneKeyLatch`) */
const 다음틀 = () => act(() => vi.advanceTimersByTime(millisecondsPerFrame()))

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

/** 투구 단계 · 타석 — 웹 글자 대신 누름 칸 판(testid) · 타석 캔버스가 보이는지로 가른다. 그림은 장면이 그린다 */
const 보임 = (testId: string) => {
  const element = screen.queryByTestId(testId)
  return element !== null && element.closest('[hidden]') === null
}
const 구질보임 = () => 보임('구질 누름 칸')
const 조준보임 = () => 보임('조준 영역')
const 게이지보임 = () => 보임('게이지 누름 칸')
/** 사람 타석 장면 — BattingStage 캔버스(사람 수비 장면 `PitcherSideStage` 는 소프트키 판 아래 따로 선다) */
const 타석보임 = () => document.querySelector('canvas[class*="BattingStage_stage"]') !== null
/** 교체 창 줄 — 커서 줄이 아니면 한 번 눌러 커서를 옮기고, 커서 줄을 누르면 OK (0x495fc) */
const 벤치고르기 = (name: string) => {
  const 고르기 = screen.queryByRole('button', { name: `${name} 고르기` })
  if (고르기 !== null) fireEvent.click(고르기)
  fireEvent.click(screen.getByRole('button', { name: `${name} 교체` }))
}

afterEach(() => {
  setAutoRelayRecordPort(null)
  cleanup()
  vi.useRealTimers()
})

/** 구질 칸을 누르고(0x50da8) 0xf 의 틱 8 을 지나 조준(0x10)으로 넘어간다 (0x39c1c) */
/** 구질 칸 누름 칸 — 그림은 장면이 그리고 칸은 투명한 누름 칸이다. 읽기 이름은 "키 구질" (0x534d8) */
const 구질칸 = (name: string) => screen.getByRole('button', { name: new RegExp(` ${name}$`) })
const 구질고르기 = (name: string) => {
  fireEvent.click(구질칸(name))
  act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 8))
}

/** 조준점을 안 움직이고 OK (0x50e9c) — 존 중심을 노린다 */
const 조준확정 = () => {
  fireEvent.click(screen.getByRole('button', { name: '조준 확정' }))
  // 누름은 다음 틀의 키 0x498d4 가 읽는다(키 사건 0xbca05)
  act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
}

/** 게이지를 안 쓰는 공 — OK 뒤 0x11 의 틱 10 에 놓인다 (0x50ed0 → 0x4e060) */
const 조준확정후놓기 = () => {
  조준확정()
  act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 10))
}

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
    <TeamGameScreen options={{ ...기본옵션, ...options }} random={createSeededRandom(seed)} onFinish={vi.fn()} onQuit={vi.fn()} />,
  )
  판닫기()
  OK통과()
  return rendered
}

describe('팀 경기 화면 — 수비(투구) 차례', () => {
  it('후공이면 1회초가 우리 수비라 구질 고르기가 뜬다 (상태 0xf)', () => {
    띄우기()

    expect(구질보임()).toBe(true)
  })

  it('구질을 고르면 0xf 의 틱 8 에 코스 고르기로 넘어간다 (상태 0x10, 0x39c1c)', () => {
    띄우기()
    fireEvent.click(구질칸('FASTBALL'))
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 7))
    expect(구질보임()).toBe(true)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))

    expect(조준보임()).toBe(true)
  })

  it('코스 고르기에서 CLR 이면 구질 고르기로 돌아간다 (상태 0x10 → 0xf, 0x50ee6)', () => {
    띄우기()
    구질고르기('FASTBALL')
    expect(조준보임()).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))

    expect(구질보임()).toBe(true)
    expect(조준보임()).toBe(false)
  })

  it('게이지 설정이 꺼져 있어도 0x11 을 지나 틱 10 에 던진다 (원본 기본값 — 0x50ed0 · 0x4e060)', () => {
    // 첫 공이 타구가 안 되는 씨앗 (경기 시작 rand(0, 2) 가 차례를 한 칸 민다). 놓기 0x4dc78 의 표시 구속 굴림
    // (0x34968 → 0x66dc0 rand)이 흩어짐 앞에 끼어 첫 공이 타구가 되어 1 → 2(1 부터 센 첫 씨앗)로 옮겼다
    띄우기({}, 2)
    구질고르기('FASTBALL')
    조준확정()

    // 게이지 그림·안내는 없고 아직 안 던졌다
    expect(게이지보임()).toBe(false)
    expect(구질보임()).toBe(false)
    // 게이지가 선 다음 틀 머리가 0x11 틱 0 — 틱 10 은 열한째 틀이다
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 10))
    expect(구질보임()).toBe(false)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    // 놓았다 — 남은 0x11 비행과 0x12 대기 동안은 원본도 다음 공 입력을 안 받는다
    expect(구질보임()).toBe(false)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 80))

    // 다시 1단계로 돌아왔다 — 한 개를 던졌다는 뜻이다
    expect(구질보임()).toBe(true)
  })

  it('경기 중 메뉴를 열어도 투구 단계는 숨긴 채 멈춘다 — 닫으면 게이지 틱이 이어진다 (팝업 동안 장면 정지 0x52cc6)', () => {
    띄우기({ gaugeSettingOn: true })
    구질고르기('FASTBALL')
    조준확정()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 5))

    fireEvent.keyDown(window, { key: '*' })
    // '*' 는 다음 틀의 키 자리(49918)에서 창을 세우고, 그 틀의 갱신(0x11 게이지)은 게이트(52cc6) 뒤라 한 번 더 돈다
    다음틀()
    // 내리지 않고 숨긴다
    expect(screen.getByTestId('게이지 누름 칸').closest('[hidden]')).not.toBeNull()
    // 메뉴 동안은 틱이 안 흘러 공이 안 나간다
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 30))
    fireEvent.keyDown(window, { key: '*' })

    // 0x11 그대로 — 처음부터가 아니라 남은 틱 뒤에 놓는다 (r161 게이지 열한째 셈 + r167 '*' 다음 틀)
    expect(screen.getByTestId('게이지 누름 칸').closest('[hidden]')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 4))
    expect(게이지보임()).toBe(true)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(게이지보임()).toBe(false)
  })

  it('게이지를 켜면 투구 결정 단계가 뜬다 (상태 0x11)', () => {
    띄우기({ gaugeSettingOn: true })
    구질고르기('FASTBALL')
    조준확정()

    expect(게이지보임()).toBe(true)
  })
})

describe('팀 경기 화면 — 인플레이 타구는 수비 화면으로 (상태 0x17)', () => {
  /**
   * 사람이 던진 공이 인플레이 타구가 되면 **투구 단계 대신 수비 화면**이 뜬다.
   * 원본도 그 순간 경기 장면이 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며 키를 읽는다.
   *
   * ⚠️ 시험 DOM 에는 캔버스도 프레임 원점 JSON 도 없어 야수·공 그림은 확인할 수 없다 —
   * 구장 배경이 섰는지로 화면이 바뀐 것만 본다 (`DefensePlayback.test.tsx` 와 같은 한계).
   * 붙든 상태를 다시 푸는 쪽은 `useTeamGame.test.tsx` 가 본다.
   */
  it('던진 공이 타구가 되면 구질 고르기가 사라지고 수비 화면이 뜬다', () => {
    const { container } = 띄우기()

    // 타구가 날 때까지 같은 구질·코스로 던진다 (씨앗 20100901 은 여덟 번째 투구에서 난다)
    for (let pitch = 0; pitch < 200; pitch += 1) {
      // 새 타자면 0xe 에서 OK 부터
      OK통과()
      if (!구질보임()) break
      구질고르기('FASTBALL')
      조준확정후놓기()
      // 남은 0x11 비행 · 0x12 대기 동안은 다음 공을 안 받는다 — 수비 화면이 뜨면 거기서 멈춘다
      for (let 틱 = 0; 틱 < 80; 틱 += 1) {
        if (container.querySelector(`img[src="${DEFENSE_BACKGROUND_URL}"]`) !== null) break
        if (구질보임()) break
        act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
      }
    }

    expect(구질보임()).toBe(false)
    // 타석으로 넘어간 것이 아니다 — 수비 화면이다
    expect(타석보임()).toBe(false)
    expect(container.querySelector(`img[src="${DEFENSE_BACKGROUND_URL}"]`)).not.toBeNull()
  })
})

describe('팀 경기 화면 — 공격(타석) 차례', () => {
  /** 0xe 의 투수·타자 소개 판 0x44944 가 설 때까지 틱을 흘린다 */
  const 소개판까지 = () => {
    for (let 틱 = 0; 틱 < 40 && screen.queryByTestId('타자판') === null; 틱 += 1) {
      act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    }
  }
  /** 소개 판의 타자 칸 — 이름(0xb62c0)과 타순 숫자(팀 +0x32 + 1, num 그림 번호) */
  const 타자칸 = () => {
    const 판 = screen.getByTestId('타자판')
    return {
      name: 판.querySelector('[data-testid="이름"]')?.textContent ?? null,
      order: [...판.querySelectorAll<HTMLElement>('[data-testid="타순"]')].map((node) => node.dataset.image),
    }
  }

  it('선공이면 1회초가 우리 공격이라 타석이 뜬다', () => {
    vi.useFakeTimers()
    render(
      <TeamGameScreen
        options={{ ...기본옵션, playerSide: PLAYER_SIDE_FIRST_BAT }}
        random={createSeededRandom(20100901)}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
      />,
    )
    판닫기()

    expect(타석보임()).toBe(true)
    // 0xe 소개 판의 타자 칸이 타순 1번과 **명단에 선 타자 이름**을 적는다 (대타가 붙은 뒤로는 이름이 바뀐다)
    소개판까지()
    expect(타자칸()).toEqual({ name: '박택용', order: ['31'] })
    // 같은 화면에 투구 단계가 함께 뜨지 않는다 — 공수는 번갈아 돈다
    expect(구질보임()).toBe(false)
  })

  it("'#' 가 공격 중에는 **대타** 화면을 연다 (0x49598 의 공격 가지)", () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    fireEvent.keyDown(window, { key: '#' })

    // 제목 글자는 img_text 149 "타자" + 299 "교체" (S10 4절 — 규칙은 대타지만 화면 글자는 "타자 교체")
    expect(screen.getByTestId('타자 교체 창')).toBeTruthy()
    // 수비 쪽 제목은 안 뜬다
    expect(screen.queryByTestId('투수 교체 창')).toBeNull()
  })

  it('고른 마타자가 대타로 타석에 선다 (원본에서 마타자가 타석에 서는 유일한 길)', () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT, aceBatterId: 0 })
    fireEvent.keyDown(window, { key: '#' })
    벤치고르기('메디카')

    expect(screen.queryByTestId('타자 교체 창')).toBeNull()
    // 대타가 서면 0xe 로 돌아와 소개 판이 다시 선다 — 같은 타순 1번에 메디카
    소개판까지()
    expect(타자칸()).toEqual({ name: '메디카', order: ['31'] })
  })
})

describe('경기 중 메뉴 (표 0xcfcfc 행 0)', () => {
  it('다섯 칸이 원본 차례대로 뜬다 — 계속·자동진행·조작방법·설정·나가기', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    다음틀()

    expect(screen.getByRole('listbox', { name: '경기 중 메뉴' })).toBeTruthy()
    for (const 칸 of ['계속하기', '자동진행', '게임방법', '환경설정', '메인메뉴']) {
      expect(screen.getByRole('option', { name: 칸 })).toBeTruthy()
    }
  })

  it("'*' 키로도 메뉴가 열린다 (0x498d4 는 소프트키1 을 '*' 로 읽는다)", () => {
    띄우기()
    fireEvent.keyDown(window, { key: '*' })
    // 받은 틀에는 아직 없다 — 다음 틀의 키 0x498d4 가 연다
    expect(screen.queryByRole('listbox', { name: '경기 중 메뉴' })).toBeNull()
    다음틀()

    expect(screen.getByRole('listbox', { name: '경기 중 메뉴' })).toBeTruthy()
  })

  it('나가기를 고르면 StrGAME[0] 확인 문구가 뜬다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    다음틀()
    fireEvent.click(screen.getByRole('option', { name: '메인메뉴' }))

    expect(screen.getByText(/메인메뉴로 나가시겠습니까/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '예' })).toBeTruthy()
  })

  it('G포인트를 안 넘기면 자동진행 칸이 잠긴다 (비용을 검사할 수 없다)', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    다음틀()
    const 자동진행 = screen.getByRole('option', { name: '자동진행' }).closest('button')

    expect(자동진행?.disabled).toBe(true)
  })

  it('자동진행은 30 G 를 묻고, 모자라면 StrGAME[5] 알림만 뜬다 (0x3c7d8)', () => {
    vi.useFakeTimers()
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
    다음틀()
    fireEvent.click(screen.getByRole('option', { name: '자동진행' }))

    expect(screen.getByText(/30 G포인트/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(screen.getByText(/G포인트가 부족합니다/)).toBeTruthy()
    expect(onSpendGamePoint).not.toHaveBeenCalled()
  })

  it('G포인트가 넉넉하면 비용을 알리고 경기를 자동으로 소화한다', () => {
    vi.useFakeTimers()
    // 전역기록 새 저장 — 속도 +0xbc = 1
    setAutoRelayRecordPort(createMemoryAutoRelayRecordPort())
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
    다음틀()
    fireEvent.click(screen.getByRole('option', { name: '자동진행' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onSpendGamePoint).toHaveBeenCalledWith(30)
    // 자동진행 중계(상태 0x21)가 선다 — 새 저장 속도 1 이면 4틱마다 0xc262c 한 번
    expect(screen.getByTestId('중계-속도').dataset.speed).toBe('1')
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 8 * 400))
    // 시즌 경기는 끝까지 소화된다 — 상태 0x18 경기 끝 결과 판(승·패·세 세 줄)이 먼저 뜬다
    expect(screen.getByAltText('승리투수')).toBeTruthy()
    // 처음 10틱은 OK 가 안 먹고(경기+0x32), 그 뒤 OK → 정산(0x19) 자리인 요약 화면
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByTestId('정산-판')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 10))
    fireEvent.keyDown(window, { key: 'Enter' })
    다음틀()
    // 정산(0x19)은 원본 240×320 한 장 — 웹 껍데기 제목 띠("경기 결과")가 없다
    expect(screen.getByTestId('정산-판')).toBeTruthy()
    expect(screen.queryByText('경기 결과')).toBeNull()
    vi.useRealTimers()
  })

  it('대전모드(8)는 100 G 다', () => {
    vi.useFakeTimers()
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
    다음틀()
    fireEvent.click(screen.getByRole('option', { name: '자동진행' }))

    expect(screen.getByText(/100 G포인트/)).toBeTruthy()
  })
})

describe('투수 교체 (#)', () => {
  it('우리 수비 차례면 # 교체 소프트키가 뜨고, 벤치 목록이 열린다 (상태 0xb)', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '# 교체' }))

    expect(screen.getByTestId('투수 교체 창')).toBeTruthy()
    expect(screen.getByTestId('교체 줄 지금 선수')).toBeTruthy()
  })

  it("교체 창(상태 0xb)에서는 '*'·메뉴 소프트키가 안 먹는다 — 창이 그대로고 메뉴도 안 열린다 (0x498d4 '*' 는 0xd~0x15 만)", () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '# 교체' }))
    fireEvent.keyDown(window, { key: '*' })

    expect(screen.getByTestId('투수 교체 창')).toBeTruthy()
    expect(screen.queryByRole('listbox', { name: '경기 중 메뉴' })).toBeNull()
    const 메뉴 = screen.getByRole('button', { name: '메뉴' })
    expect((메뉴 as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(메뉴)
    expect(screen.getByTestId('투수 교체 창')).toBeTruthy()
    expect(screen.queryByRole('listbox', { name: '경기 중 메뉴' })).toBeNull()
    // 창을 닫으면(0x495fc 의 '#'·CLR) 다시 먹는다
    fireEvent.click(screen.getByRole('button', { name: '# 취소' }))
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByRole('listbox', { name: '경기 중 메뉴' })).toBeTruthy()
  })

  it("'0' 이 선수 정보 창(0x5b798)을 열고 닫는다 — 커서는 ↑↓ 로 감기고, 커서 줄을 누르면 교체다 (0x495fc)", () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '# 교체' }))
    expect(screen.queryByTestId('선수 정보 창')).toBeNull()
    fireEvent.keyDown(window, { key: '0' })
    expect(screen.getByTestId('선수 정보 창')).toBeTruthy()
    // 창이 다 열린 뒤(여섯째 그림)에야 능력치 도형이 선다
    expect(screen.queryByTestId('선수 정보 도형')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 8))
    expect(screen.getByTestId('선수 정보 도형')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '0 INFO' }))
    expect(screen.queryByTestId('선수 정보 창')).toBeNull()

    // 위로 한 칸이면 맨 끝 줄로 감긴다 — 그 줄을 누르면 교체가 확정되어 창이 닫힌다
    const 줄들 = screen.getAllByRole('button', { name: / (교체|고르기)$/ })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    const 커서줄 = screen.getAllByRole('button', { name: / 교체$/ })
    expect(커서줄).toHaveLength(1)
    expect(줄들.length).toBeGreaterThan(0)
    fireEvent.click(커서줄[0])
    expect(screen.queryByTestId('투수 교체 창')).toBeNull()
  })

  it('우리 공격 차례에는 교체 입구가 없다 — 원본은 그 자리에서 대타를 연다', () => {
    띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })

    expect(screen.queryByRole('button', { name: '# 교체' })).toBeNull()
  })
})

describe('경기 시작 인트로 (상태 0xc)', () => {
  it('시즌(모드 2)은 인트로가 54틱 서고 다 지나면 1회초 판으로 넘어간다', () => {
    vi.useFakeTimers()
    render(<TeamGameScreen options={기본옵션} random={createSeededRandom(20100901)} onFinish={vi.fn()} onQuit={vi.fn()} />)
    expect(screen.getByTestId('인트로-띠')).toBeTruthy()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 53))
    expect(screen.queryByTestId('인트로-띠')).toBeTruthy()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.queryByTestId('인트로-띠')).toBeNull()
    // 1회초 판(0x18) — 판은 OK 를 기다린다
    expect(screen.getByTestId('교대-판-1회초')).toBeTruthy()
    vi.useRealTimers()
  })

  it('대전(모드 8)은 0xc 를 안 지난다 — 인트로가 없다 (0x48b20)', () => {
    render(<TeamGameScreen options={{ ...기본옵션, mode: 8 }} random={createSeededRandom(20100901)} onFinish={vi.fn()} onQuit={vi.fn()} />)
    expect(screen.queryByTestId('인트로-띠')).toBeNull()
  })
})

describe('상태 0xe — 새 타석마다 사람 OK 를 기다린다 (0x39e14 → 0x532b0)', () => {
  const 판까지 = (options: Partial<TeamGameOptions> = {}) => {
    vi.useFakeTimers()
    render(<TeamGameScreen options={{ ...기본옵션, ...options }} random={createSeededRandom(20100901)} onFinish={vi.fn()} onQuit={vi.fn()} />)
    판닫기()
  }

  it('수비 차례: OK 전에는 구질 고르기가 없고, 들어선 뒤 세 갱신 안의 OK 는 안 먹는다 (0x49a26)', () => {
    판까지()
    expect(구질보임()).toBe(false)
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
    fireEvent.keyDown(window, { key: '5' })
    expect(구질보임()).toBe(false)
    // 시간 제한·자동 진행이 없다 (0x39bd4)
    act(() => vi.advanceTimersByTime(60_000))
    expect(구질보임()).toBe(false)
    fireEvent.keyDown(window, { key: '5' })
    expect(구질보임()).toBe(true)
  })

  it("0xe 에서 '#' 교체 창이 열리고(0x4994a) 닫으면 다시 0xe — '*' 메뉴도 열리고 메뉴가 떠 있으면 OK 를 안 받는다", () => {
    판까지()
    // 0xd(두 그림)는 '#' 가 여는 상태 범위(0xe·0xf) 밖이다
    fireEvent.keyDown(window, { key: '#' })
    expect(screen.queryByTestId('투수 교체 창')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: '#' })
    expect(screen.getByTestId('투수 교체 창')).toBeTruthy()
    // 창이 떠 있으면 OK 를 안 받는다 — '#' 로 닫으면(0x495fc 취소) 곧장 0xe 에 다시 선다
    fireEvent.keyDown(window, { key: '#' })
    expect(screen.queryByTestId('투수 교체 창')).toBeNull()
    expect(구질보임()).toBe(false)
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByRole('listbox', { name: '경기 중 메뉴' })).toBeTruthy()
    // 메뉴의 '5' 는 숫자키 꼴 2 — 다섯째 칸(메인메뉴)을 곧바로 골라 질문 창이 뜬다. 창이 키를 먹는 동안 장면 OK 는 없다(0x754f8)
    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: '*' })
    expect(구질보임()).toBe(false)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(구질보임()).toBe(true)
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

  it("'*' 일시정지 창 아래에도 소개 판이 남는다 — 0x52efe 가 장면 그리기를 건너뛰어 마지막 그림이 그대로다", () => {
    판까지()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_PREPARE_FRAMES))
    expect(screen.getByTestId('소개판')).toBeTruthy()
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByRole('option', { name: /계속/ })).toBeTruthy()
    expect(screen.getByTestId('소개판')).toBeTruthy()
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByTestId('소개판')).toBeTruthy()
  })

  it('공격 차례도 같다 — 타석 장면은 서지만 OK 전에는 공이 안 나간다', () => {
    판까지({ playerSide: PLAYER_SIDE_FIRST_BAT })
    expect(타석보임()).toBe(true)
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
    OK통과()
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
  })
})

describe('로딩 판 (상태 7 · 9 · 8 — 생성자 0x3301c 33100 이 모드 갈래 없이 상태 7)', () => {
  it.each([1, 2, 8])(
    '모드 %i 도 경기 화면보다 먼저 로딩 판이 선다 — 팁은 0x53dbc 의 rand(0, 73) 칸 StrTIP[1 + n] · 진행 칸 끝 0x24(기본)',
    (mode) => {
      로딩판.length = 0
      띄우기({ mode }, 7)
      expect(로딩판).toEqual([{ tip: LOADING_TIPS[rollSceneLoadingTip(createSeededRandom(7))], steps: undefined }])
    },
  )
})
