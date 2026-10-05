import { describe, expect, it } from 'vitest'
import { PITCHER_TRAINING_MENUS, runPitcherTraining } from '@/entities/pitcher-career/model/pitcherManagement'
import {
  createPitcherCareer, equippedPitcherAbilityOf, pitcherAbilityLimitsOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { runPitcherRest } from '@/pages/pitcher-league/model/pitcherRest'
import { pitcherRestDetailRowsOf, pitcherTrainingDetailRowsOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 투수편 상세 결과 창 — 0x872a1 두 모드 공용, 이름표·한계만 모드 3 갈래 */

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  morale: 50,
  skillIds: [],
  ...overrides,
  equippedSkillIds: overrides.equippedSkillIds ?? overrides.skillIds ?? [],
})
const 메뉴 = (id: string) => PITCHER_TRAINING_MENUS.find((menu) => menu.id === id)!
const 고정 = (position: number): RandomPort => ({
  next: () => position,
  nextInRange: (minimum, maximum) => minimum + position * (maximum - minimum),
  pick: (candidates) => candidates[0],
})

describe('투수 훈련 결과 창 (0x18c58~0x18d4e)', () => {
  it('이름표 340~343 · 84, 현재값 0xb6415(기록,k,1) · 최대값 보직 한계 · 사기 100', () => {
    const outcome = runPitcherTraining(투수(), 메뉴('변화'), 고정(0))
    const rows = pitcherTrainingDetailRowsOf(outcome)!
    const 실효 = equippedPitcherAbilityOf(outcome.career)
    const 한계 = pitcherAbilityLimitsOf(outcome.career)

    expect(rows.map((row) => row.labelFrame)).toEqual([340, 341, 342, 343, 84])
    expect(rows.map((row) => row.current)).toEqual([실효.control, 실효.velocity, 실효.breaking, 실효.stamina, outcome.career.morale])
    expect(rows.map((row) => row.maximum)).toEqual([한계.control, 한계.velocity, 한계.breaking, 한계.stamina, 100])
  })

  it('변화량은 굴린 값 · 넷째 칸은 보정 — 사이드암(타입 1) 제구 + 표적판(서브 0): 굴림 4, 보정 +1 +2', () => {
    const before = 투수({ typeIndex: 1, subItemIds: [0] })
    const outcome = runPitcherTraining(before, 메뉴('제구'), 고정(0))
    const rows = pitcherTrainingDetailRowsOf(outcome)!

    expect(outcome.career.ability.control - before.ability.control).toBe(7)
    expect(rows.map((row) => row.change)).toEqual([4, 0, 0, 0, -5])
    expect(rows.map((row) => row.bonus)).toEqual([3, 0, 0, 0, 0])
  })

  it('사기 칸 보정은 감소량 부호 그대로 — 자동안마기(서브 4) −1 ([sp+0xf8])', () => {
    const outcome = runPitcherTraining(투수({ subItemIds: [4] }), 메뉴('구속'), 고정(0))
    const rows = pitcherTrainingDetailRowsOf(outcome)!

    expect(rows[4]).toMatchObject({ change: -5, bonus: -1 })
  })

  it('마구(칸 4)는 0x18bd8 에서 갈라져 이 창이 없다', () => {
    const outcome = runPitcherTraining(투수({ popularity: 1000, gamePoint: 1000 }), 메뉴('마구'), 고정(0))
    expect(pitcherTrainingDetailRowsOf(outcome)).toBeNull()
  })
})

describe('투수 휴식 결과 창 (0x18ede~0x18fc2)', () => {
  it('사기 칸은 회복 굴림 그대로(100 에서 잘리기 전) · 능력치 칸과 보너스는 0', () => {
    const rest = runPitcherRest(투수({ morale: 95 }), 고정(0.999))
    const rows = pitcherRestDetailRowsOf(rest.career, rest.moraleGain)

    expect(rest.career.morale).toBe(100)
    expect(rows.map((row) => row.change)).toEqual([0, 0, 0, 0, 15])
    expect(rows.every((row) => row.bonus === 0)).toBe(true)
  })
})
