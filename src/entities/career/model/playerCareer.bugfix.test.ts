import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createCareer, startNextSeason } from '@/entities/career/model/playerCareer'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-27 새 시즌 0xa39a8 이 +0x1e0 을 두 번 지워 +0x1f0 이 해를 넘김', () => {
  const 쌓인 = { ...createCareer('선수'), gameSkillCounters: [0, 3, 2, 4, 0, 30, 5] }

  it('원본: 경기 뒤 누적 카운터(스킬 조건 10 · 11 · 16)가 새 시즌에 남는다', () => {
    expect(startNextSeason(쌓인, createConstantRandom(0)).gameSkillCounters).toEqual([0, 3, 2, 4, 0, 30, 5])
  })

  it('고침: 새 시즌에 지운다 — 다른 칸은 원본과 같다', () => {
    const 원본 = startNextSeason(쌓인, createConstantRandom(0))
    setBugfixConfigForTests(bugfixConfigWith(['B-27']))
    const 고침 = startNextSeason(쌓인, createConstantRandom(0))
    expect(고침.gameSkillCounters ?? []).toEqual([])
    expect({ ...고침, gameSkillCounters: undefined }).toEqual({ ...원본, gameSkillCounters: undefined })
  })
})
