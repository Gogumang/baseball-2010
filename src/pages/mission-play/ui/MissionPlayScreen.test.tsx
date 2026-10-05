// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MissionPlayScreen } from '@/pages/mission-play/ui/MissionPlayScreen'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { startMission } from '@/entities/mission/model/missionRun'
import { MISSIONS } from '@/shared/config/original/missions'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

const stageProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }))

// 타석 화면은 넘겨받은 값만 본다 — 캔버스 없이 props 만 잡는다
vi.mock('@/widgets/batting-stage/ui/BattingStage', () => ({
  BattingStage: (props: Record<string, unknown>) => {
    stageProps.last = props
    return null
  },
}))

afterEach(() => {
  cleanup()
  stageProps.last = null
})

/** 압도 22 — 0xb62b4(타자, 22) 장착이면 CPU 실투율 +5 (0x33d52) */
const 압도 = [22]

describe('미션 타석은 치는 선수의 장착 스킬을 타석 화면에 넘긴다', () => {
  it('미션 (모드 6)', () => {
    const mission = MISSIONS.find((candidate) => candidate.side === '타자')!
    render(
      <MissionPlayScreen
        run={startMission(mission)}
        ability={ROOKIE_BATTER_ABILITY}
        batterSkillIds={압도}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        opponent={null}
        atBat={createAtBat()}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onGiveUp={vi.fn()}
        onFinish={vi.fn()}
        onSteal={vi.fn()}
      />,
    )
    expect(stageProps.last?.batterSkillIds).toEqual(압도)
  })
})
