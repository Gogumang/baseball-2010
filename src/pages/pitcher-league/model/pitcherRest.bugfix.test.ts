import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { pitcherRestBlockReasonOf } from '@/pages/pitcher-league/model/pitcherRest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-24 투수편 휴식 가드 (0x12682)', () => {
  const 아픈투수 = { ...createPitcherCareer('투수'), morale: 100, isSick: true }

  it('원본: 사기 100 이면 아파도 거절', () => {
    expect(pitcherRestBlockReasonOf(아픈투수)).toBe('사기최고')
  })

  it('고침: 아프거나 다치면 받는다 — 건강하면 여전히 거절', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-24']))
    expect(pitcherRestBlockReasonOf(아픈투수)).toBeNull()
    expect(pitcherRestBlockReasonOf({ ...아픈투수, isSick: false, isInjured: true })).toBeNull()
    expect(pitcherRestBlockReasonOf({ ...아픈투수, isSick: false })).toBe('사기최고')
  })
})
