import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { nariMoraleOf, withNariGameMorale, withNariMorale } from '@/entities/career/model/nariMorale'
import { createNariCupTeams } from '@/entities/career/model/nariCupTeams'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-17 국가대항전 중 나리 사기 칸이 상대국 칸 (0x1f988 → 0x1f8f8 1f964~1f970)', () => {
  const 대회 = { morale: 37, nationalCup: createNationalCup(), nariCupTeams: createNariCupTeams(7, 11) }

  it('원본: 대회 중에는 상대국 칸 +2 를 읽고 쓴다', () => {
    expect(nariMoraleOf(대회)).toBe(100)
    expect(withNariMorale(대회, 85).morale).toBe(37)
  })

  it('고침: 대회 중에도 내 커리어 사기를 읽고 쓴다 — 상대국 칸은 손대지 않는다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-17']))
    expect(nariMoraleOf(대회)).toBe(37)
    const 썼다 = withNariMorale(대회, 150)
    expect(썼다.morale).toBe(100)
    expect(썼다.nariCupTeams).toBe(대회.nariCupTeams)
    expect(withNariGameMorale(대회)).toBe(대회)
  })
})
