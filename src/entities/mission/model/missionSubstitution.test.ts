import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import { missionAllowsSubstitution } from '@/entities/mission/model/missionSubstitution'

describe("미션의 '#' 교체 — 0x38984 의 [ctx+0xa8] = 1 & ~레코드[1] (0xaa6b6)", () => {
  it('원본 표의 바이트 1 은 모두 짝수라 모든 미션이 \'#\' 를 막는다', () => {
    expect(MISSIONS.length).toBeGreaterThan(0)
    expect(MISSIONS.filter(missionAllowsSubstitution)).toEqual([])
  })
})
