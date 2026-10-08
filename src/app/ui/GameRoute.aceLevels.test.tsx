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
const { staminaPercentOf } = await import('@/entities/pitcher-career/model/pitcherStamina')

afterEach(() => {
  cleanup()
  받은것.length = 0
})

const 레오니 = ACE_PITCHERS[1]

const 띄우기 = (aceLevels?: Readonly<Record<number, number>>) => {
  const base = startGame(createSeededRandom(20100901))
  // 경기 시작 자동진행(0x21) 중계는 이 시험의 몫이 아니다 — 곧장 내 타석
  const progress: GameProgress = { ...base, aceOpponent: 레오니, autoRelay: null }
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
    // 마투수도 지금 마운드 +0x2c 의 체력% 0xaebb0 을 싣는다 — 투구 AI 의 피로 0xb58e6 · 지친 제구 등급 0xb74bc
    const 체력 = staminaPercentOf(startGame(createSeededRandom(20100901)).opponentMound.stamina)
    // 깎은 뒤 체력%(`staminaPercentAfterPitch`)는 공이 손을 떠나는 0x11 진입(0x3dec6 → 0xa5e14)의 셈 — 투구 AI · 스윙이 본다
    const 깎는셈 = { staminaPercentAfterPitch: expect.any(Function) }
    expect(띄우기({}).pitcherAbility).toEqual({ ...pitcherAbilityOf(레오니, {}, 체력), ...깎는셈 })
    expect(띄우기({}).pitcherAbility).toMatchObject({ control: 35, velocity: 51, breaking: 35 })
    // Lv5(칸 1 = 4) 는 100% — 날 값
    expect(띄우기({ 1: 4 }).pitcherAbility).toEqual({ ...pitcherAbilityOf(레오니, undefined, 체력), ...깎는셈 })
    // 직구 한 개는 체력을 깎으므로 깎은 뒤 체력%가 지금보다 크지 않다
    expect(띄우기({}).pitcherAbility?.staminaPercentAfterPitch?.(1)).toBeLessThanOrEqual(체력)
  })

  it('레벨 칸을 타석 화면까지 넘긴다 — 마구 횟수 0xd8509[레벨] (0xaebe4) 이 본다', () => {
    expect(띄우기({ 1: 3 }).aceLevels).toEqual({ 1: 3 })
  })
})
