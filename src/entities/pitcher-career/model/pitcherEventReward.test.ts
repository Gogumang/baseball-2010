import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { applyPitcherEventRewards, finishPitcherEvent } from '@/entities/pitcher-career/model/pitcherEventReward'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({ ...createPitcherCareer('테스트'), ...overrides })

describe('투수편 이벤트 보상 (0x8c460 모드 3 갈래)', () => {
  it('0 인기도 · 1 평판 · 2 사기 · 3 소지금(100만 단위) — 커리어 칸이라 타자편과 같다', () => {
    const 앞 = 투수({ popularity: 100, reputation: 100, morale: 50, money: 1000 })
    const 뒤 = applyPitcherEventRewards(앞, [
      { kind: 0, value: 10 },
      { kind: 1, value: -20 },
      { kind: 2, value: 70 },
      { kind: 3, value: 5 },
    ])
    expect(뒤).toMatchObject({ popularity: 110, reputation: 80, morale: 100, money: 1500 })
  })

  it('6 은 히든 변화구 계열 v 를 연다 (선수[0x204 + v] = 1, 0x8c5da — 투수편만)', () => {
    expect(applyPitcherEventRewards(투수(), [{ kind: 6, value: 0 }]).hiddenPitchRows).toEqual([true, false, false, false])
  })

  it('13~16 은 제구·구속·변화·체력 +v 뒤 보직 한계(0xd4d88 ×10)로 자른다 — 구원 체력 600', () => {
    const 선발 = applyPitcherEventRewards(투수({ ability: { control: 795, velocity: 100, breaking: 100, stamina: 100 } }), [
      { kind: 13, value: 10 },
      { kind: 16, value: 10 },
    ])
    expect(선발.ability).toEqual({ control: 800, velocity: 100, breaking: 100, stamina: 110 })

    const 구원 = applyPitcherEventRewards(
      투수({ role: PITCHER_ROLE.relief, ability: { control: 845, velocity: 100, breaking: 100, stamina: 595 } }),
      [{ kind: 17, value: 10 }],
    )
    expect(구원.ability).toEqual({ control: 850, velocity: 110, breaking: 110, stamina: 600 })
  })

  it('4 는 스킬 비트 v−1 획득(자동 장착) / −v 해제', () => {
    const 얻음 = applyPitcherEventRewards(투수({ skillIds: [], equippedSkillIds: [] }), [{ kind: 4, value: 11 }])
    expect(얻음.skillIds).toContain(10)
    expect(얻음.equippedSkillIds).toContain(10)
    expect(applyPitcherEventRewards(얻음, [{ kind: 4, value: -11 }]).skillIds).not.toContain(10)
  })

  it('7 히든 오픈 |v| · 10 G (0~99999) · 20 연봉', () => {
    const 뒤 = applyPitcherEventRewards(투수({ gamePoint: 99_990, salary: 50, popularity: 100, popularityAtSeasonStart: 100 }), [
      { kind: 7, value: 43 },
      { kind: 10, value: 100 },
      { kind: 20, value: 0 },
    ])
    expect(뒤.openedHiddenIds).toEqual([43])
    expect(뒤.gamePoint).toBe(99_999)
    // base = max(1, 0/4) + 50 = 51 → +30% = 51 + 15
    expect(뒤.salary).toBe(66)
  })

  it('11 은 v ≥ 0 이면 질병(기간 3 · 쿨다운 20), 음수면 치료', () => {
    const 아픔 = applyPitcherEventRewards(투수(), [{ kind: 11, value: 0 }], createSeededRandom(1))
    expect(아픔).toMatchObject({ isSick: true, illnessRemaining: 3, illnessCooldown: 20 })
    expect(applyPitcherEventRewards(아픔, [{ kind: 11, value: -1 }]).isSick).toBe(false)
  })

  it('393~396 은 연차 보정 (0x8d508) — 3년차 393 인기도 +3·2 · 평판 −2·2', () => {
    const 뒤 = applyPitcherEventRewards(투수({ season: 3, popularity: 100, reputation: 100 }), [
      { kind: 0, value: 30 },
      { kind: 1, value: 44 },
    ], undefined, 393)
    expect(뒤).toMatchObject({ popularity: 136, reputation: 140 })
  })

  it('452~454 의 보상을 마치면 그 해 중간평가 비트가 선다 (0x8cbaa → 0xa424c)', () => {
    const 뒤 = applyPitcherEventRewards(투수({ season: 2 }), [{ kind: 2, value: 20 }], undefined, 453)
    expect(뒤.midSeasonEvaluatedYears).toEqual([1])
    expect(applyPitcherEventRewards(투수(), [{ kind: 2, value: 20 }], undefined, 455).midSeasonEvaluatedYears).toEqual([])
  })

  it('본 이벤트는 한 번씩만 본 표시를 남긴다', () => {
    expect(finishPitcherEvent(투수({ seenEventIds: ['380'] }), [380, 381, 381]).seenEventIds).toEqual(['380', '381'])
  })
})
