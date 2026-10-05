import { describe, expect, it } from 'vitest'
import { swingFactorsOf, swingResultOf } from '@/entities/batting/model/swingResult'
import type { SwingResultInput } from '@/entities/batting/model/swingResult'
import { NO_SWING_BOOST } from '@/entities/batting/model/swingBoost'
import type { SwingBoost } from '@/entities/batting/model/swingBoost'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 기본입력 = (overrides: Partial<SwingResultInput> = {}): SwingResultInput => ({
  horizontalError: 0,
  verticalError: 0,
  timing: 100,
  buntKind: 0,
  controlTier: 3,
  batter: { hit: 300, power: 300 },
  pitcher: { control: 300, velocity: 300 },
  mode: '일반',
  isPitcherExhausted: false,
  batterSkillIds: [],
  pitcherSkillIds: [],
  situation: { inning: 1, isLosing: false, runnerCount: 0, hasSecondBaseRunner: false, pitcherSide: 0, batterSide: 0, balls: 0, strikes: 0, batterOrderIndex: 0, recentAtBatCodes: [] },
  ...overrides,
})

/** 뽑힌 값을 차례로 돌려주는 난수. rand(a,b) = a + floor(next × (b−a)) */
function 순서난수(values: readonly number[]): RandomPort & { readonly draws: number[] } {
  const draws: number[] = []
  let index = 0
  return {
    draws,
    next: () => {
      const value = values[index] ?? 0
      index += 1
      draws.push(value)
      return value
    },
    nextInRange: () => {
      throw new Error('판정은 next 만 쓴다')
    },
    pick: (candidates) => candidates[0],
  }
}

describe('swingFactorsOf — 0xab214 중간값 (디컴파일 대조)', () => {
  // 기본값은 능력치가 같아 H = P = 0 이므로 B = 500+2800+0+500, C = 350+500+0+500 이고
  // 스윙 배율 (timing−77)×2+100 을 곱한 값이다.
  it.each([
    [100, 12000, 5548, 1971],
    [79, 9480, 3952, 1404],
    [54, 6480, 2052, 729],
  ])('timing %i → contact %i · B %i · C %i', (timing, contact, solid, homeRun) => {
    expect(swingFactorsOf(기본입력({ timing }))).toEqual({ contact, solid, homeRun })
  })

  it('timing 0 이면 contact 0', () => {
    expect(swingFactorsOf(기본입력({ timing: 0 })).contact).toBe(0)
  })

  it('마선수가 없으면 나만의리그도 일반 계수(280·200·400, K 500)를 쓴다', () => {
    expect(swingFactorsOf(기본입력({ mode: '나만의리그' }))).toEqual(swingFactorsOf(기본입력()))
  })

  it('나만의리그에서 타자가 마선수면 400−35×레벨 보너스가 붙고 계수가 250·400·430·K 1000 으로 바뀐다', () => {
    const factors = swingFactorsOf(기본입력({ mode: '나만의리그', isBatterAce: true, aceBonusLevel: 0 }))

    // H = P = 300+400 − 300 = 400, contact = trunc((trunc(400×1000/1000)+1200) × 100 / 10)
    expect(factors.contact).toBe(16000)
    // B = (500 + 2500 + trunc(trunc((400×400×3 + 400×430)/100)/4) + 500) × 146/100
    expect(factors.solid).toBe(7489)
    // C = (350 + 700 + trunc(400×430/100) + 500) × 146/100
    expect(factors.homeRun).toBe(4774)
  })

  it('레벨이 오르면 마선수 보너스가 줄고 0 에서 멈춘다 (타자 35/레벨 · 투수 40/레벨 — 레벨 출처는 미해결)', () => {
    const 레벨0 = swingFactorsOf(기본입력({ mode: '나만의리그', isBatterAce: true, aceBonusLevel: 0 }))
    const 레벨10 = swingFactorsOf(기본입력({ mode: '나만의리그', isBatterAce: true, aceBonusLevel: 10 }))
    const 레벨20 = swingFactorsOf(기본입력({ mode: '나만의리그', isBatterAce: true, aceBonusLevel: 20 }))

    // 레벨 10 이면 400−350 = 50, 레벨 20 이면 음수라 0 으로 막는다
    expect(레벨10.contact).toBeLessThan(레벨0.contact)
    expect(레벨20.contact).toBeLessThan(레벨10.contact)
    expect(레벨20.contact).toBe(swingFactorsOf(기본입력({ mode: '나만의리그', isBatterAce: true, aceBonusLevel: 99 })).contact)
  })

  it('나만의리그에서 투수가 마선수면 투수 능력에 400−40×레벨이 더해져 타자가 불리해진다', () => {
    const 보통 = swingFactorsOf(기본입력({ mode: '나만의리그' }))
    const 마투수 = swingFactorsOf(기본입력({ mode: '나만의리그', isPitcherAce: true, aceBonusLevel: 0 }))

    // H = 300 − (300+400) = −400 이라 contact 가 떨어진다
    expect(마투수.contact).toBeLessThan(보통.contact)
    expect(마투수.solid).toBeLessThan(보통.solid)
  })

  it('미션에서 마선수 투수는 보너스가 100 이고 계수는 일반 그대로다', () => {
    const 미션 = swingFactorsOf(기본입력({ mode: '미션', isPitcherAce: true }))
    const 리그 = swingFactorsOf(기본입력({ mode: '나만의리그', isPitcherAce: true, aceBonusLevel: 0 }))

    expect(미션.contact).toBeLessThan(swingFactorsOf(기본입력()).contact)
    expect(미션.contact).toBeGreaterThan(리그.contact)
  })

  it('투수가 탈진하면 B 는 배율 뒤에, C 는 배율 앞에 2000 이 붙는다 (원본 순서)', () => {
    const 기본 = swingFactorsOf(기본입력())
    const 탈진 = swingFactorsOf(기본입력({ isPitcherExhausted: true }))

    expect(탈진.solid).toBe(기본.solid + 2000)
    expect(탈진.homeRun).toBe(Math.trunc(((350 + 500 + 2000 + 500) * 146) / 100))
  })
})

describe('swingResultOf — 판정 순서', () => {
  it('번트용 rand(0,100) 을 먼저 뽑고, contact 이상이면 헛스윙', () => {
    const random = 순서난수([0.5, 0.99])
    expect(swingResultOf(기본입력({ timing: 54 }), random)).toEqual({ kind: '헛스윙' })
    expect(random.draws).toHaveLength(2)
  })

  it('B·C 를 모두 넘기면 홈런성(24)', () => {
    // r100, contact, B(0 < 4818), C(0 < 1241)
    expect(swingResultOf(기본입력(), 순서난수([0, 0, 0, 0]))).toEqual({ kind: '타구', code: 24, isSolid: true })
  })

  it('B 만 넘기면 경계 2956 으로 15·18 을 가른다 — C 1971 에서 trunc(1971×120 ÷ trunc(8029/100))', () => {
    expect(swingResultOf(기본입력(), 순서난수([0, 0, 0, 0.5, 0.2957]))).toEqual({ kind: '타구', code: 15, isSolid: true })
    expect(swingResultOf(기본입력(), 순서난수([0, 0, 0, 0.5, 0.2955]))).toEqual({ kind: '타구', code: 18, isSolid: true })
  })

  it('B 를 못 넘기면 30% 파울(9), 35% 뜬공(0), 35% 땅볼(3) — 0·3 은 잘 맞지 않음', () => {
    const 결과 = (value: number) => swingResultOf(기본입력(), 순서난수([0, 0, 0.9, value]))
    expect(결과(0.29)).toEqual({ kind: '타구', code: 9, isSolid: true })
    expect(결과(0.3)).toEqual({ kind: '타구', code: 0, isSolid: false })
    expect(결과(0.65)).toEqual({ kind: '타구', code: 3, isSolid: false })
  })

  it('번트는 코스 오차 20·18 을 넘으면 헛스윙, 종류 1 은 75% 성공 (6/12)', () => {
    expect(swingResultOf(기본입력({ buntKind: 1, horizontalError: 21 }), 순서난수([0]))).toEqual({ kind: '헛스윙' })
    expect(swingResultOf(기본입력({ buntKind: 1 }), 순서난수([0.74]))).toEqual({ kind: '타구', code: 6, isSolid: true })
    expect(swingResultOf(기본입력({ buntKind: 1 }), 순서난수([0.75]))).toEqual({ kind: '타구', code: 12, isSolid: true })
    expect(swingResultOf(기본입력({ buntKind: 3 }), 순서난수([0.49]))).toEqual({ kind: '타구', code: 8, isSolid: true })
  })

  it('타자 스킬 18 은 B 를 10% 깎는다', () => {
    const 기본 = swingFactorsOf(기본입력())
    expect(swingFactorsOf(기본입력({ batterSkillIds: [18] })).solid).toBe(기본.solid - Math.trunc(기본.solid / 10))
  })
})

describe('보정 구조체 0x34d6c — 필살타법·마구 (0xab4dc · 0xabd92)', () => {
  const 보정 = (overrides: Partial<SwingBoost>): SwingBoost => ({ ...NO_SWING_BOOST, ...overrides })

  it('out[0]·out[2] 는 타자 히트·파워에 그대로 더한다 — 능력치 +150 과 같다 (contact 에도 들어간다)', () => {
    expect(swingFactorsOf(기본입력({ boost: 보정({ batterHit: 150, batterPower: 150 }) }))).toEqual(
      swingFactorsOf(기본입력({ batter: { hit: 450, power: 450 } })),
    )
  })

  it('out[4]·out[6] 은 투수 구속·제구에 배율 **앞**에 더한다', () => {
    const 결과 = swingFactorsOf(기본입력({ controlTier: 5, boost: 보정({ pitcherVelocity: 180, pitcherControl: 200 }) }))
    expect(결과).toEqual(swingFactorsOf(기본입력({ controlTier: 5, pitcher: { velocity: 480, control: 500 } })))
  })

  it('out[0xa]·out[0xb] 는 스킬 보정 뒤에 B += B·%/100, C += C·%/100 (0 쪽 버림)', () => {
    const 스킬만 = swingFactorsOf(기본입력({ batterSkillIds: [18] }))
    const 결과 = swingFactorsOf(기본입력({ batterSkillIds: [18], boost: 보정({ solidPercent: 15, homeRunPercent: 6 }) }))
    expect(결과.contact).toBe(스킬만.contact)
    expect(결과.solid).toBe(스킬만.solid + Math.trunc((스킬만.solid * 15) / 100))
    expect(결과.homeRun).toBe(스킬만.homeRun + Math.trunc((스킬만.homeRun * 6) / 100))
  })

  it('마구 % 도 타자 B·C 를 **올린다** — 원본 부호 그대로', () => {
    const 마구 = swingFactorsOf(기본입력({ boost: 보정({ pitcherVelocity: 150, pitcherControl: 150, solidPercent: 10, homeRunPercent: 7 }) }))
    const 능력만 = swingFactorsOf(기본입력({ pitcher: { velocity: 450, control: 450 } }))
    expect(마구.solid).toBe(능력만.solid + Math.trunc((능력만.solid * 10) / 100))
    expect(마구.homeRun).toBe(능력만.homeRun + Math.trunc((능력만.homeRun * 7) / 100))
  })

  it('상한(B 9000 · C 4500)은 % 를 더한 **뒤**에 판정에서 자른다 — 난수 차례는 그대로', () => {
    const random = 순서난수([0, 0, 0, 0])
    expect(swingResultOf(기본입력({ boost: 보정({ batterHit: 220, batterPower: 220, solidPercent: 20, homeRunPercent: 9 }) }), random)).toEqual({
      kind: '타구',
      code: 24,
      isSolid: true,
    })
    expect(random.draws).toHaveLength(4)
  })
})
