// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useMissionSession } from '@/app/model/useMissionSession'
import type { Screen } from '@/app/model/screen'
import { aceMatchMissionOf } from '@/entities/story/model/aceMatch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'

/** 투구 화면이 받은 속성 — 그림은 여기서 볼 것이 아니라 갈아 끼운다 */
interface 받은속성 {
  run: PitcherRun
  onGiveUp: () => void
  onFinish: () => void
  onRestart?: () => void
  settings?: unknown
  onSettingsChange?: unknown
}
const 받은것: 받은속성[] = []
vi.mock('@/pages/pitching/ui/PitchingScreen', () => ({
  PitchingScreen: (props: 받은속성) => {
    받은것.push(props)
    return null
  },
}))

const { PitcherAceMatchRoute } = await import('@/app/ui/MissionRoutes')

afterEach(() => {
  cleanup()
  받은것.length = 0
})

const 설정 = { settings: { pitchControl: '게이지' }, setSettings: vi.fn() }

describe('투수편 마선수 대결 화면 (`renderAceMatch` 가 그린다)', () => {
  it('경기 중 메뉴 다시하기(0x3c706 → 0x3c98e → 장면 0x107 상태 3)는 같은 대결을 처음부터 세운다 — 설정 칸도 열린다', () => {
    const mission = aceMatchMissionOf(17, '투수')
    if (mission === null) throw new Error('투수 미션 17 이 없다')
    const onFinish = vi.fn()
    const screen: Screen = { kind: '투수편' }

    function Harness() {
      const runner = useAtBatRunner()
      const session = useMissionSession({
        runner, random: createSeededRandom(1), missionRecord: { load: () => ({}), save: vi.fn() }, screen, setScreen: vi.fn(),
      })
      return (
        <PitcherAceMatchRoute
          mission={mission!} session={session} runner={runner} pitchControl="게이지" gameSettings={설정 as never}
          onFinish={onFinish}
        />
      )
    }
    render(<Harness />)

    const shown = 받은것.at(-1)!
    expect(shown.settings).toBe(설정.settings)
    expect(shown.onSettingsChange).toBe(설정.setSettings)
    expect(shown.onRestart).toBeTypeOf('function')
    act(() => shown.onGiveUp())
    expect(받은것.at(-1)?.run.status).toBe('실패')
    // 다시하기 — 새 판(진행중)이고 여전히 대결이다: 끝나면 투수편으로 이겼나를 넘긴다
    act(() => 받은것.at(-1)!.onRestart!())
    const again = 받은것.at(-1)!
    expect(again.run.mission).toBe(mission)
    expect(again.run.status).toBe('진행중')
    act(() => again.onGiveUp())
    act(() => 받은것.at(-1)!.onFinish())
    expect(onFinish).toHaveBeenCalledWith(false)
  })

  it('들어서면 투수 미션 레코드로 대결을 세워 투구 화면을 띄우고, 결과 [확인]에서 이겼나를 넘긴다', () => {
    const mission = aceMatchMissionOf(18, '투수')
    if (mission === null) throw new Error('투수 미션 18 이 없다')
    const onFinish = vi.fn()
    const screen: Screen = { kind: '투수편' }
    const random = createSeededRandom(1)

    function Harness() {
      const runner = useAtBatRunner()
      const session = useMissionSession({
        runner, random, missionRecord: { load: () => ({}), save: vi.fn() }, screen, setScreen: vi.fn(),
      })
      return (
        <PitcherAceMatchRoute
          mission={mission!} session={session} runner={runner} pitchControl="게이지" gameSettings={설정 as never}
          onFinish={onFinish}
        />
      )
    }
    render(<Harness />)

    const shown = 받은것.at(-1)
    expect(shown?.run.mission).toMatchObject({ side: '투수', id: 18, name: '로제' })
    act(() => shown?.onGiveUp())
    const finished = 받은것.at(-1)
    expect(finished?.run.status).toBe('실패')
    act(() => finished?.onFinish())
    expect(onFinish).toHaveBeenCalledWith(false)
  })
})
