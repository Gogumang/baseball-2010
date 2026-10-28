// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

function 메모리저장(held: unknown): JsonStorePort {
  let saved = held
  return {
    load: () => saved,
    save: (value: object) => {
      saved = value
    },
  }
}

const 평가중 = () => ({
  ...createPitcherCareer('평가'),
  gamesPlayed: 3,
  seasonEndState: 116,
  seasonPopularityGain: 10,
  lastEvaluation: { popularityChange: 2, reputationChange: 0, moraleChange: 0 },
  lastGame: { decisionCode: 0, outs: 0, runs: 0, strikeouts: 0, walksAndHitByPitch: 0, hitsAllowed: 0, pitches: 0, managerCommentIndex: 38 },
})

const 이어하기 = () => renderHook(() => usePitcherLeagueSession(메모리저장(평가중()), createSeededRandom(20100901), false)).result.current.career

describe('B-28 투수편 116 이어하기가 경기 뒤 카운터를 다시 씀 (0x1278c)', () => {
  it('원본: +0x1c2 += +0x4a 를 한 번 더 한다', () => {
    expect(이어하기()?.seasonPopularityGain).toBe(12)
  })

  it('고침: 저장 그대로 — 평가 창(116)만 다시 선다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-28']))
    const career = 이어하기()
    expect(career?.seasonPopularityGain).toBe(10)
    expect(career?.seasonEndState).toBe(116)
  })
})
