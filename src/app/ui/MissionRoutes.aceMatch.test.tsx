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
const 받은것: { run: PitcherRun; onGiveUp: () => void; onFinish: () => void }[] = []
vi.mock('@/pages/pitching/ui/PitchingScreen', () => ({
  PitchingScreen: (props: { run: PitcherRun; onGiveUp: () => void; onFinish: () => void }) => {
    받은것.push(props)
    return null
  },
}))

const { PitcherAceMatchRoute } = await import('@/app/ui/MissionRoutes')

afterEach(() => {
  cleanup()
  받은것.length = 0
})

describe('투수편 마선수 대결 화면 (`renderAceMatch` 가 그린다)', () => {
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
      return <PitcherAceMatchRoute mission={mission!} session={session} runner={runner} pitchControl="게이지" onFinish={onFinish} />
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
