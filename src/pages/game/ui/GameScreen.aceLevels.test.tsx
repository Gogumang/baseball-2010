// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { startGame } from '@/features/play-game/model/gameFlow'

/** 타석 그림이 받은 레벨 칸 — 마구 횟수를 세우는 곳(useStageAnimation)은 batting-stage 가 따로 시험한다 */
const 받은레벨: (Readonly<Record<number, number>> | undefined)[] = []
vi.mock('@/widgets/batting-stage/ui/BattingStage', () => ({
  BattingStage: (props: { aceLevels?: Readonly<Record<number, number>> }) => {
    받은레벨.push(props.aceLevels)
    return null
  },
}))

const { GameScreen } = await import('@/pages/game/ui/GameScreen')

afterEach(() => {
  cleanup()
  받은레벨.length = 0
})

describe('나만의리그 경기 화면 → 타석 그림 마선수 레벨', () => {
  it('받은 레벨 칸을 BattingStage.aceLevels 로 그대로 넘긴다', () => {
    render(
      <GameScreen
        career={createCareer('테스트')}
        progress={startGame(createSeededRandom(20100901))}
        atBat={createAtBat()}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        aceLevels={{ 2: 4 }}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onQuit={vi.fn()}
      />,
    )
    expect(받은레벨.at(-1)).toEqual({ 2: 4 })
  })
})
