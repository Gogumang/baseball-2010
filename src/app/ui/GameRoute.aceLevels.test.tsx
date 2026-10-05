// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { ACE_PITCHERS, pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import { startGame } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'

/** 경기 화면이 받은 속성 — 타석 그림은 여기서 볼 것이 아니라 갈아 끼운다 */
const 받은것: { pitcherAbility?: PitcherAbility; aceLevels?: Readonly<Record<number, number>> }[] = []
vi.mock('@/pages/game/ui/GameScreen', () => ({
  GameScreen: (props: { pitcherAbility: PitcherAbility; aceLevels?: Readonly<Record<number, number>> }) => {
    받은것.push({ pitcherAbility: props.pitcherAbility, aceLevels: props.aceLevels })
    return null
  },
}))

const { GameRoute } = await import('@/app/ui/GameRoute')

afterEach(() => {
  cleanup()
  받은것.length = 0
})

const 레오니 = ACE_PITCHERS[1]

const 띄우기 = (aceLevels?: Readonly<Record<number, number>>) => {
  const base = startGame(createSeededRandom(20100901))
  const progress: GameProgress = { ...base, aceOpponent: 레오니 }
  const noop = () => {}
  const session = {
    loadingTip: null,
    handlePitchResolved: noop,
    actions: {
      finishLoading: noop, finishDefensePlay: noop, closeBurstResult: noop, quitGame: noop, stealBase: noop, cpuPickoff: noop,
    },
  }
  const runner = { atBat: createAtBat(), isPaused: false, bannerText: '' }
  const gameSettings = { settings: {}, setSettings: noop }
  render(
    <GameRoute
      session={session as never}
      progress={progress}
      runner={runner as never}
      random={createSeededRandom(1)}
      career={createCareer('테스트')}
      gameSettings={gameSettings as never}
      {...(aceLevels === undefined ? {} : { aceLevels })}
    />,
  )
  // 경기 시작 인트로(상태 0xc)를 OK 로 건너뛴다
  fireEvent.keyDown(window, { key: 'Enter' })
  return 받은것[받은것.length - 1]!
}

describe('나만의리그 마선수 대결 — 전역 마선수 레벨 (mgr[0x13a..0x143])', () => {
  it('상대 마투수 능력치에 0xb6414 배율 0xd88aa[레벨] 을 먹인다 — 레오니 Lv1 60%', () => {
    expect(띄우기({}).pitcherAbility).toEqual(pitcherAbilityOf(레오니, {}))
    expect(띄우기({}).pitcherAbility).toMatchObject({ control: 35, velocity: 51, breaking: 35 })
    // Lv5(칸 1 = 4) 는 100% — 날 값
    expect(띄우기({ 1: 4 }).pitcherAbility).toEqual(pitcherAbilityOf(레오니))
  })

  it('레벨 칸을 타석 화면까지 넘긴다 — 마구 횟수 0xd8509[레벨] (0xaebe4) 이 본다', () => {
    expect(띄우기({ 1: 3 }).aceLevels).toEqual({ 1: 3 })
  })
})
