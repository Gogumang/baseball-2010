import { describe, expect, it } from 'vitest'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { createParticleScene } from '@/entities/particle/model/particleScene'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { derbyDistanceOf } from '@/entities/home-run-derby/model/derbyRules'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import {
  isDefensePlayFinished,
  startDefensePlay,
  stepDefensePlay,
  type DefensePlayInput,
} from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  DEFENSE_SCENE_START,
  defenseEffectsOf,
  defenseTickFactsOf,
  endDefenseEffects,
  sceneMemoryOf,
  stepDefenseEffects,
  tickBeforeOf,
  type DefenseTickFacts,
} from '@/pages/defense/lib/defenseHomeRunEffects'
import { generalHomeRunTextOn, HOME_RUN_TEXT_SCENE_START } from '@/widgets/batting-stage/lib/homeRunBanner'

const 설정: ParticleConfig = {
  ang: 0, spread: 0, spd: 0, spdR: 0, emit: 1, emitR: 0, life: 3, lifeR: 0,
  a0: 0, a0R: 0, a1: 0, a1R: 0, ax: 0, ay: 0, w: 0, h: 0, total: 1, mode: 2,
}

function 세는난수(): RandomPort & { calls: number } {
  const random = {
    calls: 0,
    next: () => {
      random.calls += 1
      return 0
    },
    nextInRange: (minimum: number) => minimum,
    pick: <T,>(candidates: readonly T[]) => candidates[0],
  }
  return random
}

const 판입력 = (outcome: DefensePlayInput['outcome']): DefensePlayInput => ({
  outcome,
  outcomeIsGiven: true,
  trajectory: battedBallTrajectory(fixturePatternFor(outcome)),
  bases: EMPTY_BASES,
  outs: 0,
  defenseIsCpu: true,
})

/** 판을 끝까지 돌리며 틱마다 연출이 볼 것을 모은다 */
function 틱사실들(input: DefensePlayInput): DefenseTickFacts[] {
  let state = startDefensePlay(input)
  const facts: DefenseTickFacts[] = []
  while (!isDefensePlayFinished(state)) {
    const before = tickBeforeOf(state)
    state = stepDefensePlay(state, null)
    facts.push(defenseTickFactsOf(before, state, isDefensePlayFinished(state)))
  }
  return facts
}

describe('수비 판(0x17) 홈런 연출 — 진행기 틱에서 읽는 것', () => {
  const 홈런 = 판입력({ kind: '홈런' })
  const 궤적 = 홈런.trajectory
  const facts = 틱사실들(홈런)

  it('홈런 갈래(0x51c82)는 담장선 틱에 한 번 — 결과 코드 8 이 나는 틱', () => {
    const 갈래 = facts.flatMap((fact, tick) => (fact.homeRunBranch ? [tick] : []))
    expect(갈래).toEqual([궤적.fenceTick])
  })

  it('+0x36 은 담장선 틱에 낙구 점의 비거리로 쓴다 (0x528f0 — aa0 ≥ aa4)', () => {
    const 쓴틱 = facts.flatMap((fact, tick) => (fact.displayDistance !== null ? [tick] : []))
    expect(쓴틱).toEqual([궤적.fenceTick])
    expect(facts[궤적.fenceTick].displayDistance).toBe(derbyDistanceOf(궤적.pointAt(궤적.landingTick)))
  })

  it('글자는 홈런 틱부터 관문이 닫히기 전 틱까지 그린다 (0x46e2e — 관문 · state[0x1d])', () => {
    const 그림 = facts.flatMap((fact, tick) => (fact.drawsText ? [tick] : []))
    expect(그림[0]).toBe(궤적.fenceTick)
    // 관문을 닫은 마지막 틱은 안 그린다
    expect(그림[그림.length - 1]).toBe(facts.length - 2)
    expect(그림).toHaveLength(facts.length - 1 - 궤적.fenceTick)
  })

  it('홈런이 아닌 판은 아무것도 없다', () => {
    const 안타 = 틱사실들(판입력({ kind: '안타', bases: 1 }))
    expect(안타.some((fact) => fact.homeRunBranch || fact.drawsText || fact.displayDistance !== null)).toBe(false)
  })
})

describe('수비 판 홈런 연출 — 원본 프레임 차례', () => {
  const 켜는틱: DefenseTickFacts = { homeRunBranch: true, displayDistance: 120, drawsText: true }
  const 그리는틱: DefenseTickFacts = { homeRunBranch: false, displayDistance: null, drawsText: true }

  it('홈런 갈래가 글자를 일반 홈런 칸(5+i)으로 켜고 비거리 판이 +0x36 을 보인다 — 장면의 반짝임 셈(+0x1962)은 이어진다', () => {
    const particles = createParticleScene()
    const 장면 = { ...DEFENSE_SCENE_START, textScene: { ...HOME_RUN_TEXT_SCENE_START, flashCounter: 9 } }
    const frame = stepDefenseEffects(defenseEffectsOf(장면), 켜는틱, { particles, configOf: () => 설정 })
    expect(frame.distanceBoard).toBe(120)
    expect(frame.text).not.toBeNull()
    expect(frame.effects.text.flashCounter).toBe(9)
    expect(frame.effects.text.slots).toEqual(generalHomeRunTextOn(HOME_RUN_TEXT_SCENE_START).slots)
    expect(frame.effects.fireworks).not.toBeNull()
  })

  it('글자가 꺼져 있으면(홈런 갈래 전) 그리기 틱이어도 글자 · 판이 없다 (0x40b22 · 0x36cea)', () => {
    const particles = createParticleScene()
    const frame = stepDefenseEffects(defenseEffectsOf(DEFENSE_SCENE_START), 그리는틱, { particles, configOf: () => 설정 })
    expect(frame.text).toBeNull()
    expect(frame.distanceBoard).toBeNull()
  })

  it('효과 틱은 유지 단계를 그린 그림에서만 — 일반 홈런은 켠 뒤 29번째 그림부터 굴린다 (0x40faa)', () => {
    const particles = createParticleScene()
    const random = 세는난수()
    let effects = defenseEffectsOf(DEFENSE_SCENE_START)
    const 굴림: number[] = []
    for (let draw = 1; draw <= 40; draw += 1) {
      const before = random.calls
      effects = stepDefenseEffects(effects, draw === 1 ? 켜는틱 : 그리는틱, { particles, random, configOf: () => 설정 }).effects
      굴림.push(random.calls - before)
    }
    // 날아 들어오기 22 + 흔들기 6 = 28 그림 동안 효과 칸이 안 돈다 — 빈 파티클 장면의 틱도 안 굴린다
    expect(굴림.slice(0, 28).every((count) => count === 0)).toBe(true)
    expect(굴림.slice(28).some((count) => count > 0)).toBe(true)
  })

  it('난수가 없으면 효과 틱 · 파티클 틱을 안 돌린다 — 글자는 그린다', () => {
    const particles = createParticleScene()
    let effects = defenseEffectsOf(DEFENSE_SCENE_START)
    for (let draw = 1; draw <= 40; draw += 1) {
      effects = stepDefenseEffects(effects, draw === 1 ? 켜는틱 : 그리는틱, { particles, configOf: () => 설정 }).effects
    }
    expect(particles.emitters).toHaveLength(0)
    expect(effects.text.stage).toBe(4)
  })

  it('판이 닫힌 뒤 그림은 파티클 틱만 — 0x35108 이 글자를 끄고 파티클을 치우며 장면 칸은 남는다', () => {
    const particles = createParticleScene()
    const random = 세는난수()
    let effects = defenseEffectsOf(DEFENSE_SCENE_START)
    for (let draw = 1; draw <= 40; draw += 1) {
      effects = stepDefenseEffects(effects, draw === 1 ? 켜는틱 : 그리는틱, { particles, random, configOf: () => 설정 }).effects
    }
    expect(particles.emitters.length).toBeGreaterThan(0)
    const 닫힘 = stepDefenseEffects(effects, null, { particles, random, configOf: () => 설정 })
    expect(닫힘.text).toBeNull()
    expect(닫힘.effects.text).toEqual(effects.text)
    const 끝 = endDefenseEffects(닫힘.effects, particles)
    expect(끝.textOn).toBe(false)
    expect(particles.emitters).toHaveLength(0)
    expect(sceneMemoryOf(끝)).toEqual({ textScene: effects.text, displayDistance: 120 })
  })
})
