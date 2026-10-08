// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useMissionSession } from '@/app/model/useMissionSession'
import type { Screen } from '@/app/model/screen'
import { aceMatchMissionOf } from '@/entities/story/model/aceMatch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/** 투구 화면이 받은 속성 — 그림은 여기서 볼 것이 아니라 갈아 끼운다 */
interface 받은속성 {
  run: PitcherRun
  onGiveUp: () => void
  onFinish: () => void
  onRestart?: () => void
  settings?: unknown
  onSettingsChange?: unknown
  onPopupFrozenChange?: (isFrozen: boolean) => void
}
const 받은것: 받은속성[] = []
vi.mock('@/pages/pitching/ui/PitchingScreen', () => ({
  PitchingScreen: (props: 받은속성) => {
    받은것.push(props)
    return null
  },
}))

const 재생 = vi.fn()
vi.mock('@/pages/defense/ui/DefensePlayback', () => ({
  DefensePlayback: (props: unknown) => {
    재생(props)
    return null
  },
}))

const { PitcherAceMatchRoute } = await import('@/app/ui/MissionRoutes')

afterEach(() => {
  cleanup()
  받은것.length = 0
  재생.mockClear()
  vi.useRealTimers()
})

const 설정 = { settings: { pitchControl: '게이지' }, setSettings: vi.fn() }

describe('투수편 마선수 대결 화면 (`renderAceMatch` 가 그린다)', () => {
  it('경기 중 메뉴 다시하기(0x3c706 → 0x3c98e → 장면 0x107 상태 3)는 같은 대결을 처음부터 세운다 — 설정 칸도 열린다', () => {
    const mission = aceMatchMissionOf(17, '투수')
    if (mission === null) throw new Error('투수 미션 17 이 없다')
    const onFinish = vi.fn()
    const screen: Screen = { kind: '투수편' }
    let 세션: ReturnType<typeof useMissionSession> | null = null

    function Harness() {
      const runner = useAtBatRunner()
      const session = useMissionSession({
        runner, random: createSeededRandom(1), missionRecord: { load: () => ({}), save: vi.fn() }, screen, setScreen: vi.fn(),
      })
      세션 = session
      return (
        <PitcherAceMatchRoute
          mission={mission!} session={session} runner={runner} pitchControl="게이지" gameSettings={설정 as never}
          onFinish={onFinish} onQuit={vi.fn()}
        />
      )
    }
    render(<Harness />)
    // 첫 0x18 판의 OK → 0xd → 0xe
    act(() => 세션!.actions.confirmHalfInningBoard())

    const shown = 받은것.at(-1)!
    expect(shown.settings).toBe(설정.settings)
    expect(shown.onSettingsChange).toBe(설정.setSettings)
    expect(shown.onRestart).toBeTypeOf('function')
    act(() => 세션!.actions.giveUpPitcher())
    expect(받은것.at(-1)?.run.status).toBe('실패')
    // 다시하기 — 새 판(진행중)이고 여전히 대결이다: 끝나면 투수편으로 이겼나를 넘긴다
    act(() => 받은것.at(-1)!.onRestart!())
    // 다시 세운 장면도 첫 0x18 판부터
    act(() => 세션!.actions.confirmHalfInningBoard())
    const again = 받은것.at(-1)!
    expect(again.run.mission).toBe(mission)
    expect(again.run.status).toBe('진행중')
    act(() => 세션!.actions.giveUpPitcher())
    act(() => 받은것.at(-1)!.onFinish())
    expect(onFinish).toHaveBeenCalledWith(false)
  })

  it('경기 중 "나가기" 0x40140 — 결과 판 없이 메인 메뉴로, 투수편 세션은 대결을 내려놓는다(이겼나를 안 넘긴다)', () => {
    const mission = aceMatchMissionOf(17, '투수')
    if (mission === null) throw new Error('투수 미션 17 이 없다')
    const onFinish = vi.fn()
    const onQuit = vi.fn()
    const setScreen = vi.fn()
    const screen: Screen = { kind: '투수편' }
    let 세션: ReturnType<typeof useMissionSession> | null = null

    function Harness() {
      const runner = useAtBatRunner()
      const session = useMissionSession({
        runner, random: createSeededRandom(1), missionRecord: { load: () => ({}), save: vi.fn() }, screen, setScreen,
      })
      세션 = session
      return (
        <PitcherAceMatchRoute
          mission={mission!} session={session} runner={runner} pitchControl="게이지" gameSettings={설정 as never}
          onFinish={onFinish} onQuit={onQuit}
        />
      )
    }
    render(<Harness />)
    act(() => 세션!.actions.confirmHalfInningBoard())
    act(() => 받은것.at(-1)!.onGiveUp())
    expect(onQuit).toHaveBeenCalledTimes(1)
    expect(setScreen).toHaveBeenLastCalledWith({ kind: '메인메뉴' })
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('들어서면 투수 미션 레코드로 대결을 세워 투구 화면을 띄우고, 결과 [확인]에서 이겼나를 넘긴다', () => {
    const mission = aceMatchMissionOf(18, '투수')
    if (mission === null) throw new Error('투수 미션 18 이 없다')
    const onFinish = vi.fn()
    const screen: Screen = { kind: '투수편' }
    const random = createSeededRandom(1)
    let 세션: ReturnType<typeof useMissionSession> | null = null

    function Harness() {
      const runner = useAtBatRunner()
      const session = useMissionSession({
        runner, random, missionRecord: { load: () => ({}), save: vi.fn() }, screen, setScreen: vi.fn(),
      })
      세션 = session
      return (
        <PitcherAceMatchRoute
          mission={mission!} session={session} runner={runner} pitchControl="게이지" gameSettings={설정 as never}
          onFinish={onFinish} onQuit={vi.fn()}
        />
      )
    }
    const view = render(<Harness />)

    // 미션 장면은 상태 8 끝에서 곧장 첫 0x18 판 — 첫 반 이닝(CPU 공격 · 사람 수비)이 사람 몫이라 판이 OK 를 기다린다
    expect(받은것).toHaveLength(0)
    expect(view.getByText(/회(초|말)$/)).toBeTruthy()
    act(() => view.getByText('확인').click())

    const shown = 받은것.at(-1)
    expect(shown?.run.mission).toMatchObject({ side: '투수', id: 18, name: '로제' })
    act(() => 세션!.actions.giveUpPitcher())
    const finished = 받은것.at(-1)
    expect(finished?.run.status).toBe('실패')
    act(() => finished?.onFinish())
    expect(onFinish).toHaveBeenCalledWith(false)
  })

  it('볼넷 · 사구 밀어내기 판(종류 2)은 0x12 대기 0x1f 틱 뒤에 재생 칸을 연다 — 그동안 투구 화면 (0x4e6d4 → 0xae24c)', () => {
    vi.useFakeTimers()
    const mission = aceMatchMissionOf(17, '투수')
    if (mission === null) throw new Error('투수 미션 17 이 없다')
    const 밀어내기 = { kind: 2, pitchJudgement: '볼넷', ticks: [{}] } as never

    let 세션: ReturnType<typeof useMissionSession> | null = null

    function Harness() {
      const runner = useAtBatRunner()
      const session = useMissionSession({
        runner, random: createSeededRandom(1), missionRecord: { load: () => ({}), save: vi.fn() }, screen: { kind: '투수편' },
        setScreen: vi.fn(),
      })
      세션 = session
      return (
        <PitcherAceMatchRoute
          mission={mission!} session={{ ...session, pickoffReplay: 밀어내기 }} runner={runner} pitchControl="게이지"
          gameSettings={설정 as never} onFinish={vi.fn()} onQuit={vi.fn()}
        />
      )
    }
    render(<Harness />)
    act(() => 세션!.actions.confirmHalfInningBoard())
    act(() => { vi.advanceTimersByTime(30 * millisecondsPerFrame()) })
    expect(재생).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2 * millisecondsPerFrame()) })
    expect(재생).toHaveBeenCalled()
    expect(재생.mock.lastCall?.[0]).toMatchObject({ freePassPlay: true })
  })
  it('일시정지 팝업(메뉴 · 조작방법 · 설정)이 떠 있는 동안은 0x12 대기 틱이 멈춘다 (0x52cc6)', () => {
    vi.useFakeTimers()
    const mission = aceMatchMissionOf(17, '투수')
    if (mission === null) throw new Error('투수 미션 17 이 없다')
    const 밀어내기 = { kind: 2, pitchJudgement: '볼넷', ticks: [{}] } as never

    let 세션: ReturnType<typeof useMissionSession> | null = null

    function Harness() {
      const runner = useAtBatRunner()
      const session = useMissionSession({
        runner, random: createSeededRandom(1), missionRecord: { load: () => ({}), save: vi.fn() }, screen: { kind: '투수편' },
        setScreen: vi.fn(),
      })
      세션 = session
      return (
        <PitcherAceMatchRoute
          mission={mission!} session={{ ...session, pickoffReplay: 밀어내기 }} runner={runner} pitchControl="게이지"
          gameSettings={설정 as never} onFinish={vi.fn()} onQuit={vi.fn()}
        />
      )
    }
    render(<Harness />)
    act(() => 세션!.actions.confirmHalfInningBoard())
    act(() => { vi.advanceTimersByTime(10 * millisecondsPerFrame()) })
    act(() => 받은것.at(-1)?.onPopupFrozenChange?.(true))
    act(() => { vi.advanceTimersByTime(40 * millisecondsPerFrame()) })
    expect(재생).not.toHaveBeenCalled()
    act(() => 받은것.at(-1)?.onPopupFrozenChange?.(false))
    act(() => { vi.advanceTimersByTime(19 * millisecondsPerFrame()) })
    expect(재생).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(3 * millisecondsPerFrame()) })
    expect(재생).toHaveBeenCalled()
  })
})
