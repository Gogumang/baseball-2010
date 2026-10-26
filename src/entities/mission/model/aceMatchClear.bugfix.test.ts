import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { aceMatchClearKeyOf } from '@/entities/mission/model/aceMatchClear'
import { aceMatchMissionOf } from '@/entities/story/model/aceMatch'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 대결 = (team: number) => {
  const mission = aceMatchMissionOf(team, '투수')
  if (mission === undefined || mission === null) throw new Error(`대결 ${team} 없음`)
  return mission
}

describe('B-74 마선수 대결의 미션 클리어 칸', () => {
  it('원본: 메디카(team 16 · idx 15)만 클리어 칸을 올린다', () => {
    expect(aceMatchClearKeyOf(대결(16))).not.toBeNull()
    expect(aceMatchClearKeyOf(대결(17))).toBeNull()
  })

  it('고침: 대결은 클리어 칸을 건드리지 않는다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-74']))
    expect([16, 17, 18, 19, 20].map((team) => aceMatchClearKeyOf(대결(team)))).toEqual([null, null, null, null, null])
  })
})
