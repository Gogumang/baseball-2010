import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { judgeEnding } from '@/entities/career/model/seasonFlow'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { judgePitcherEnding } from '@/entities/pitcher-career/model/pitcherSeasonFlow'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 타자 = (overrides: Partial<PlayerCareer>): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })
const 투수 = (overrides: Partial<PitcherCareer>): PitcherCareer => ({ ...createPitcherCareer('테스트'), ...overrides })

describe('B-76 인기도가 정확히 1000 이면 엔딩 판정이 없다(−1)', () => {
  it('원본: 1000 은 null(판정 없음) — 999 는 은퇴식 2, 1001 은 3', () => {
    expect(judgeEnding(타자({ season: 8, popularity: 1000 }))).toBeNull()
    expect(judgePitcherEnding(투수({ season: 8, popularity: 1000 }))).toBeNull()
    expect(judgeEnding(타자({ season: 8, popularity: 999 }))).toBe(2)
    expect(judgeEnding(타자({ season: 8, popularity: 1001 }))).toBe(3)
  })

  it('고침: 1000 도 은퇴식 2 — 둘레 값은 그대로, 7년차 전은 여전히 null', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-76']))
    expect(judgeEnding(타자({ season: 8, popularity: 1000 }))).toBe(2)
    expect(judgePitcherEnding(투수({ season: 13, popularity: 1000 }))).toBe(2)
    expect(judgeEnding(타자({ season: 8, popularity: 1001 }))).toBe(3)
    expect(judgeEnding(타자({ season: 6, popularity: 1000 }))).toBeNull()
  })
})
