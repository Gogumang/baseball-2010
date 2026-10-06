// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { spendMySpecialSwing, startGame } from '@/features/play-game/model/gameFlow'

/** 타석 그림이 받은 레벨 칸 — 마구 횟수를 세우는 곳(useStageAnimation)은 batting-stage 가 따로 시험한다 */
const 받은레벨: (Readonly<Record<number, number>> | undefined)[] = []
/** 타석 그림이 받은 필살·보너스 칸 */
interface 받은칸 {
  readonly specialSwingNumber?: number
  readonly specialSwingRemaining?: number
  readonly onSpecialSwingUsed?: (remaining: number) => void
  readonly isBatterOwnPlayer?: boolean
  readonly careerYearIndex?: number
  readonly canBunt?: boolean
}
const 받은props: 받은칸[] = []
vi.mock('@/widgets/batting-stage/ui/BattingStage', () => ({
  BattingStage: (props: 받은칸 & { aceLevels?: Readonly<Record<number, number>> }) => {
    받은레벨.push(props.aceLevels)
    받은props.push(props)
    return null
  },
}))

const { GameScreen } = await import('@/pages/game/ui/GameScreen')

afterEach(() => {
  cleanup()
  받은레벨.length = 0
  받은props.length = 0
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

describe('나만의리그 타자편 → 타석 그림 필살·내 선수 보너스 (모드 4)', () => {
  const 그리기 = (career = createCareer('테스트'), progress = startGame(createSeededRandom(20100901))) => {
    const onSpecialSwingUsed = vi.fn()
    render(
      <GameScreen
        career={career}
        progress={progress}
        atBat={createAtBat()}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onQuit={vi.fn()}
        onSpecialSwingUsed={onSpecialSwingUsed}
      />,
    )
    return { 받은: 받은props.at(-1)!, onSpecialSwingUsed }
  }

  it('고른 번호(+0x18)와 0xaebe4 가 채울 한 경기 횟수(표 0xd84f0)를 넘긴다 — 무자비(23) 장착이면 +1', () => {
    const career = { ...createCareer('테스트'), specialSwingNumber: 2 }
    expect(그리기(career).받은).toMatchObject({ specialSwingNumber: 2, specialSwingRemaining: 3 })
    cleanup()
    expect(그리기({ ...career, equippedSkillIds: [23] }).받은.specialSwingRemaining).toBe(4)
  })

  it('번호가 없으면 횟수 0 — 0xaebe4 의 B+0x18 == 0 갈래', () => {
    expect(그리기().받은.specialSwingRemaining).toBe(0)
  })

  it('남은 횟수는 진행기가 든 값을 넘기고, 줄인 값은 onSpecialSwingUsed 로 돌려준다', () => {
    const career = { ...createCareer('테스트'), specialSwingNumber: 4 }
    const progress = spendMySpecialSwing(startGame(createSeededRandom(20100901)), 1)
    const { 받은, onSpecialSwingUsed } = 그리기(career, progress)
    expect(받은.specialSwingRemaining).toBe(1)
    받은.onSpecialSwingUsed?.(0)
    expect(onSpecialSwingUsed).toHaveBeenCalledWith(0)
  })

  it('내 선수(비트7)이고 연차 idx = 시즌 − 1 (rec[0xb3], 0xab3f2)', () => {
    const career = { ...createCareer('테스트'), season: 3 }
    expect(그리기(career).받은).toMatchObject({ isBatterOwnPlayer: true, careerYearIndex: 2 })
  })
})

describe('나만의리그 타자편 번트 — 0x535a4 → 0x6a7 → 0x51e48 은 모드를 안 본다', () => {
  it('canBunt 를 켜서 넘긴다 (내 선수라 마선수 거름 0xb633c 에 안 걸린다)', () => {
    render(
      <GameScreen
        career={createCareer('테스트')}
        progress={startGame(createSeededRandom(20100901))}
        atBat={createAtBat()}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onQuit={vi.fn()}
      />,
    )
    expect(받은props.at(-1)?.canBunt).toBe(true)
  })
})
