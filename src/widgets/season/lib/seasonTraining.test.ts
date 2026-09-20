import { describe, expect, it } from 'vitest'
import { TEAM_ABILITY_LIMIT } from '@/entities/season-mode/model/seasonRecord'
import {
  HELL_TRAINING_GAIN_RANGE, HELL_TRAINING_GAME_POINT, HELL_TRAINING_INDEX,
  HELL_TRAINING_MORALE_LOSS_RANGE, MASSAGER_MORALE_RELIEF, TRAINING_GAIN_RANGE,
  TRAINING_GUARD_CEILING, TRAINING_MORALE_LOSS_RANGE, TRAINING_SLOTS, TRAINING_SUB_ITEM_GAIN,
  checkSeasonTraining,
} from '@/widgets/season/lib/seasonTraining'

/** 시즌 팀 트레이닝 — J 4-6(가드 0x9108 · 굴림 0xc074 · 적용 0xa2f24) 확정값을 못박는다 */

const 입력 = (덮어쓰기: Partial<Parameters<typeof checkSeasonTraining>[0]> = {}) => ({
  abilities: [100, 100, 100, 100],
  teamMorale: 50,
  gamePoints: 1000,
  ...덮어쓰기,
})

describe('시즌 트레이닝 표 (J 4-6)', () => {
  it('칸 0~3 은 팀 능력치, 칸 4 는 지옥훈련이다', () => {
    expect(TRAINING_SLOTS).toEqual(['투구', '타격', '집중', '근성', '지옥훈련'])
    expect(TRAINING_SLOTS[HELL_TRAINING_INDEX]).toBe('지옥훈련')
  })

  it('굴림 구간은 [a, b) 로 팀 4~6·사기 −6~8, 지옥 7~10·사기 −10~13 이다', () => {
    expect(TRAINING_GAIN_RANGE).toEqual([4, 7])
    expect(TRAINING_MORALE_LOSS_RANGE).toEqual([6, 9])
    expect(HELL_TRAINING_GAIN_RANGE).toEqual([7, 11])
    expect(HELL_TRAINING_MORALE_LOSS_RANGE).toEqual([10, 14])
  })

  it('서브 아이템 +2 · 자동안마기 사기 감소 −1 · 지옥훈련 500G', () => {
    expect(TRAINING_SUB_ITEM_GAIN).toBe(2)
    expect(MASSAGER_MORALE_RELIEF).toBe(1)
    expect(HELL_TRAINING_GAME_POINT).toBe(500)
  })

  it('⚠️ 원본 그대로 — 가드는 998 초과로 막는데 적용은 999 로 자른다', () => {
    expect(TRAINING_GUARD_CEILING).toBe(998)
    expect(TEAM_ABILITY_LIMIT).toBe(999)
    // 998 인 칸은 훈련이 되고(가드 통과) 결과만 999 로 잘린다
    expect(checkSeasonTraining(입력({ abilities: [998, 100, 100, 100] }), 0).ok).toBe(true)
    expect(checkSeasonTraining(입력({ abilities: [999, 100, 100, 100] }), 0).ok).toBe(false)
  })
})

describe('시즌 트레이닝 가드 0x9108', () => {
  it('사기가 0 이면 어느 칸도 못 한다 (StrMODE[193])', () => {
    for (let slot = 0; slot < TRAINING_SLOTS.length; slot += 1) {
      expect(checkSeasonTraining(입력({ teamMorale: 0 }), slot).reason).toBe('사기없음')
    }
  })

  it('사기 검사가 G 검사보다 먼저다', () => {
    expect(checkSeasonTraining(입력({ teamMorale: 0, gamePoints: 0 }), HELL_TRAINING_INDEX).reason)
      .toBe('사기없음')
  })

  it('지옥훈련은 G 가 500 미만이면 막힌다 (StrMODE[65])', () => {
    expect(checkSeasonTraining(입력({ gamePoints: 499 }), HELL_TRAINING_INDEX).reason).toBe('G부족')
    expect(checkSeasonTraining(입력({ gamePoints: 500 }), HELL_TRAINING_INDEX).ok).toBe(true)
  })

  it('칸 0~3 은 G 를 보지 않는다 (돈·G 없음)', () => {
    expect(checkSeasonTraining(입력({ gamePoints: 0 }), 2).ok).toBe(true)
  })

  it('⚠️ 지옥훈련은 넷 다 최대일 때만 거절하고, 일부만 최대면 그대로 진행한다', () => {
    const 일부 = checkSeasonTraining(입력({ abilities: [999, 999, 100, 100] }), HELL_TRAINING_INDEX)
    expect(일부.ok).toBe(true)
    expect(일부.maxedAbilities).toEqual(['투구', '타격'])

    const 전부 = checkSeasonTraining(입력({ abilities: [999, 999, 999, 999] }), HELL_TRAINING_INDEX)
    expect(전부.ok).toBe(false)
    expect(전부.reason).toBe('능력치최대')
    expect(전부.maxedAbilities).toEqual(['투구', '타격', '집중', '근성'])
  })

  it('칸 0~3 은 그 능력치만 보고 막는다 (StrMODE[192])', () => {
    const 입력값 = 입력({ abilities: [999, 100, 100, 100] })
    expect(checkSeasonTraining(입력값, 0).reason).toBe('능력치최대')
    expect(checkSeasonTraining(입력값, 1).ok).toBe(true)
  })
})
