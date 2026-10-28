import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { meetsSkillAcquireCondition } from '@/entities/story/model/skillCondition'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { seasonPitcherTrainingTotalOf } from '@/entities/pitcher-career/model/pitcherManagement'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })
/** 통산 = 사본 = 200 (이번 시즌 훈련 0) — s8 사본은 −56 */
const 몹쓸몸후보 = 선수({
  skillIds: [],
  gamesPlayed: 12,
  ability: { hit: 400, power: 400, defense: 400, run: 400 },
  trainingCounts: { 히트: 200 },
  seasonStartTrainingCounts: { 히트: 200 },
})

describe('B-70 칸별 훈련 수 u8 − s8', () => {
  it('원본: 사본 200 이 −56 으로 읽혀 T = 256 — 몹쓸몸(T == 0)이 안 뜬다', () => {
    expect(meetsSkillAcquireCondition(몹쓸몸후보, 4, undefined)).toBe(false)
    const 투수 = { ...createPitcherCareer('투수'), trainingCounts: { 제구: 200 }, seasonStartTrainingCounts: { 제구: 200 } }
    expect(seasonPitcherTrainingTotalOf(투수)).toBe(256)
  })

  it('고침: 참 값끼리 빼 T = 0 — 몹쓸몸이 뜨고 투수편 T 도 0', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-70']))
    expect(meetsSkillAcquireCondition(몹쓸몸후보, 4, undefined)).toBe(true)
    const 투수 = { ...createPitcherCareer('투수'), trainingCounts: { 제구: 200 }, seasonStartTrainingCounts: { 제구: 200 } }
    expect(seasonPitcherTrainingTotalOf(투수)).toBe(0)
  })
})
