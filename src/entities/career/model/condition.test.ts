import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf, ILLNESS_NAMES, rollTrainingInjury, trainingInjuryChanceOf } from '@/entities/career/model/condition'
import { blockReasonOf } from '@/entities/career/model/training'
import { outingBlockReasonOf, restBlockReasonOf } from '@/entities/career/model/outing'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({
  ...createCareer('테스트'),
  gamePoint: 9999,
  money: 9999,
  ability: { hit: 50, power: 50, run: 50, defense: 50 },
  skillIds: [],
  ...overrides,
})
const 입원 = OUTING_PLACES.flatMap((place) => place.functions).find((f) => f.id === '입원')!

const 고정난수 = (values: number[]): RandomPort => {
  let index = 0
  return {
    next: () => values[index++ % values.length],
    nextInRange: (minimum) => minimum,
    pick: (candidates) => candidates[0],
  }
}

describe('부상·질병 능력치 감소', () => {
  it('부상이면 능력치 60% 감소 (StrMODE[212])', () => {
    expect(effectiveAbilityOf(선수({ isInjured: true }))).toEqual({ hit: 20, power: 20, run: 20, defense: 20 })
  })

  it('질병이면 30% 감소 (r_event_txt[537])', () => {
    expect(effectiveAbilityOf(선수({ isSick: true }))).toEqual({ hit: 35, power: 35, run: 35, defense: 35 })
  })

  it('스킬 무력감(5) −100 · 전설(7) +50, 스킬 20 은 수비만 −100 (0xb6414)', () => {
    const 기본 = { hit: 500, power: 500, run: 500, defense: 500 }

    expect(effectiveAbilityOf(선수({ ability: 기본, skillIds: [5] }))).toEqual({ hit: 400, power: 400, run: 400, defense: 400 })
    expect(effectiveAbilityOf(선수({ ability: 기본, skillIds: [7, 20] }))).toEqual({ hit: 550, power: 550, run: 550, defense: 450 })
  })

  it('단계마다 자른다 — 능력 30 에 무력감+전설이면 0 → 50 (점검 10차)', () => {
    const 약함 = { hit: 30, power: 30, run: 30, defense: 30 }

    expect(effectiveAbilityOf(선수({ ability: 약함, skillIds: [5, 7] })).hit).toBe(50)
  })

  it('장착 레벨 보너스를 더한다 — 배트 니블 2 는 파워 +50 (표 0xd8890)', () => {
    const 기본 = { hit: 500, power: 500, run: 500, defense: 500 }
    const 장비 = { hit: 0, power: 2, run: 11, defense: 0 }

    expect(effectiveAbilityOf(선수({ ability: 기본, equipmentLevels: 장비 }))).toEqual({ hit: 500, power: 550, run: 750, defense: 500 })
  })

  it('보정 뒤에도 0~999 안에 있다', () => {
    const 약함 = { hit: 30, power: 980, run: 30, defense: 30 }

    expect(effectiveAbilityOf(선수({ ability: 약함, skillIds: [5] })).hit).toBe(0)
    expect(effectiveAbilityOf(선수({ ability: 약함, skillIds: [7] })).power).toBe(999)
  })

  it('건강하면 그대로다', () => {
    expect(effectiveAbilityOf(선수())).toEqual(선수().ability)
  })
})

describe('사기 규칙', () => {
  it('사기가 0 이면 훈련할 수 없다 (StrMODE[193])', () => {
    expect(blockReasonOf(선수({ morale: 0 }), TRAINING_MENUS[0])).toBe('사기부족')
  })

  it('사기가 최고이고 건강하면 휴식을 거절한다 (StrMODE[91])', () => {
    expect(restBlockReasonOf(선수({ morale: 100 }))).toBe('사기최고')
    expect(restBlockReasonOf(선수({ morale: 100, isInjured: true }))).toBe('사기최고')
  })

  it('외출 기능은 원본 필요 인기도가 있다 — 팬미팅 600 · 야구교실 200 · CF촬영 400 (0xcc402)', () => {
    const 기능 = (id: string) => OUTING_PLACES.flatMap((place) => place.functions).find((f) => f.id === id)!
    expect(outingBlockReasonOf(선수({ popularity: 599 }), 기능('팬미팅'))).toBe('인기도부족')
    expect(outingBlockReasonOf(선수({ popularity: 600 }), 기능('팬미팅'))).toBeNull()
    expect(outingBlockReasonOf(선수({ popularity: 399 }), 기능('CF촬영'))).toBe('인기도부족')
  })

  it('사기가 최고면 외식을 거절한다 (StrMODE[91])', () => {
    const 외식 = OUTING_PLACES.flatMap((place) => place.functions).find((f) => f.id === '외식')!
    expect(outingBlockReasonOf(선수({ morale: 100 }), 외식)).toBe('사기최고')
  })

  it('건강하면 입원을 거절한다 (StrMODE[196])', () => {
    expect(outingBlockReasonOf(선수(), 입원)).toBe('건강함')
    expect(outingBlockReasonOf(선수({ isSick: true }), 입원)).toBeNull()
  })
})

describe('훈련 부상 — 0x1b4c4 (결과 창을 닫을 때, 점검 12차)', () => {
  it('확률은 훈련 뒤 사기 구간 × 필살타법 여부 표다 (%)', () => {
    const 사기 = [71, 70, 50, 30, 10]
    expect(사기.map((morale) => trainingInjuryChanceOf(선수({ morale, skillIds: [] }), false))).toEqual([0, 1, 3, 5, 10])
    expect(사기.map((morale) => trainingInjuryChanceOf(선수({ morale, skillIds: [] }), true))).toEqual([0, 3, 5, 8, 16])
  })

  it('유리몸(4) +5 · 행운(6) −20, 0 밑으로 내려가지 않는다', () => {
    expect(trainingInjuryChanceOf(선수({ morale: 10, skillIds: [4] }), false)).toBe(15)
    expect(trainingInjuryChanceOf(선수({ morale: 10, skillIds: [6] }), false)).toBe(0)
  })

  it('bfa55(0,10000) < 확률×100 이면 부상 — 기간 3, 알림 "부상을 당했습니다."', () => {
    const 낮은사기 = 선수({ morale: 5, skillIds: [] })

    const 걸림 = rollTrainingInjury(낮은사기, false, 고정난수([0]))
    expect(걸림.career).toMatchObject({ isInjured: true, injuryRemaining: 3 })
    expect(걸림.notice).toBe('부상을 당했습니다.')

    expect(rollTrainingInjury(낮은사기, false, 고정난수([0.1])).notice).toBeNull()
  })

  it('이미 부상이면 굴리지 않는다 (질병은 따지지 않는다)', () => {
    expect(rollTrainingInjury(선수({ morale: 0, isInjured: true }), false, 고정난수([0])).notice).toBeNull()
    expect(rollTrainingInjury(선수({ morale: 0, isSick: true, skillIds: [] }), false, 고정난수([0])).career.isInjured).toBe(true)
  })

  it('질병 이름은 원본 네 가지다 (StrMODE[186]~[189])', () => {
    expect(ILLNESS_NAMES).toEqual(['감기', '몸살', '식중독', '배탈'])
  })
})
