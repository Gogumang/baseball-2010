import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { EMPTY_PITCHER_EVALUATION_RECORD, popularityChangeOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import type { PitcherEvaluationContext, PitcherEvaluationRecord } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 선발: PitcherEvaluationContext = {
  positionCode: 0,
  role: PITCHER_ROLE.starter,
  won: false,
  endedInningIndex: 8,
  teamBaserunnerAllowed: true,
  teamHitsAllowed: 8,
  teamRunsAllowed: 0,
  neverEntered: false,
  reputation: 500,
}

/** 6이닝 강판 — 완투가 아니라 실점 항만 갈린다 */
const 기록 = (runs: number): PitcherEvaluationRecord => ({
  ...EMPTY_PITCHER_EVALUATION_RECORD,
  outsRecorded: 18,
  hitsAllowed: 8,
  strikeouts: 3,
  runsAllowedField: runs,
})

describe('B-39 선발 인기도의 실점 감점이 한 번도 안 걸린다', () => {
  it('원본: 실점이 늘어도 인기도가 같다', () => {
    const 값 = [0, 3, 5, 6, 9].map((runs) => popularityChangeOf(기록(runs), { ...선발, teamRunsAllowed: runs }))
    expect(new Set(값).size).toBe(1)
  })

  it('고침: 실점 3~4 −1 · 5 −2 · 6 이상 −4 점이 붙어 인기도 눈금(starterPopularityOf)이 내려간다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-39']))
    const 기준 = popularityChangeOf(기록(0), 선발)
    const 차이 = [2, 3, 4, 5, 6, 9].map((runs) => popularityChangeOf(기록(runs), { ...선발, teamRunsAllowed: runs }) - 기준)
    // 점수 −1 · −1 · −2 · −4 · −4 가 눈금 표를 거친 값 — 실점이 늘수록 줄고, 2점 이하는 그대로
    expect(차이[0]).toBe(0)
    expect(차이.every((value, index) => index === 0 || value <= 차이[index - 1])).toBe(true)
    expect(차이[차이.length - 1]).toBeLessThan(차이[1])
    expect(차이).toEqual([0, -2, -2, -2, -3, -3])
  })
})
