// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { HomeRunDerbyScreen } from '@/pages/home-run-derby/ui/HomeRunDerbyScreen'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
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

describe('홈런더비 타석은 치는 선수의 장착 스킬을 타석 화면에 넘긴다', () => {
  it('홈런더비 (모드 7)', () => {
    render(
      <HomeRunDerbyScreen
        ability={ROOKIE_BATTER_ABILITY}
        batterSkillIds={압도}
        random={createSeededRandom(1)}
        bestDistance={0}
        gamePoint={0}
        onExit={vi.fn()}
      />,
    )
    expect(stageProps.last?.batterSkillIds).toEqual(압도)
  })
})

describe('홈런더비 번트 — 0x535a4 → 0x6a7 → 0x51e48 은 모드 7 도 막지 않는다', () => {
  it('canBunt 를 켜서 넘긴다', () => {
    render(
      <HomeRunDerbyScreen
        ability={ROOKIE_BATTER_ABILITY}
        random={createSeededRandom(1)}
        bestDistance={0}
        gamePoint={0}
        onExit={vi.fn()}
      />,
    )
    expect(stageProps.last?.canBunt).toBe(true)
  })
})
