import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { shownGameEvaluationOf } from '@/app/model/useCareerSession'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 이경기평가 = { popularityChange: 7, reputationChange: 3, moraleChange: 2, commentIndex: 1 }
const 앞경기평가 = { popularityChange: -4, reputationChange: -1, moraleChange: -2, commentIndex: 5 }
const 앞경기 = {
  evaluation: 앞경기평가,
  recordLine: { atBats: 4, hits: 1, runsBattedIn: 0, homeRuns: 0 },
} as unknown as NonNullable<PlayerCareer['lastGame']>
const 이경기기록 = { atBats: 5, hits: 4, runsBattedIn: 6, homeRuns: 4 }

describe('B-73 포스트시즌 경기 뒤 116 이 앞 정규 경기 값을 보인다', () => {
  it('원본: 앞 경기 평가 · 기록 줄', () => {
    expect(shownGameEvaluationOf(false, 이경기평가, 앞경기, 이경기기록)).toEqual({
      evaluation: 앞경기평가,
      recordLine: 앞경기.recordLine,
    })
  })

  it('고침: 기록 줄은 이 경기 · 평가 숫자는 0 — 정규시즌 경기는 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-73']))
    expect(shownGameEvaluationOf(false, 이경기평가, 앞경기, 이경기기록)).toEqual({
      evaluation: { ...이경기평가, popularityChange: 0, reputationChange: 0, moraleChange: 0 },
      recordLine: 이경기기록,
    })
    expect(shownGameEvaluationOf(true, 이경기평가, 앞경기, 이경기기록).evaluation).toEqual(이경기평가)
  })
})
