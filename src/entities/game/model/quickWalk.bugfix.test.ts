import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { EMPTY_BASES, advanceOnQuickWalk } from '@/entities/game/model/baseState'
import { forceRunners, shiftRunners } from '@/entities/game/model/baseRunners'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 삼루 = { ...EMPTY_BASES, third: true }
const 이루 = { ...EMPTY_BASES, second: true }
const 만루 = { first: true, second: true, third: true }
const 일삼루 = { first: true, second: false, third: true }

describe('B-14 간이 엔진 볼넷', () => {
  it('원본: 모든 주자가 한 루씩 — 3루 주자 혼자여도 득점', () => {
    expect(advanceOnQuickWalk(삼루)).toEqual({ bases: { first: true, second: false, third: false }, runsScored: 1, outsAdded: 0 })
    expect(advanceOnQuickWalk(이루).bases).toEqual({ first: true, second: false, third: true })
  })

  it('고침: 밀어내기 — 밀려난 주자만, 만루에서만 1점', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-14']))
    expect(advanceOnQuickWalk(삼루)).toEqual({ bases: { first: true, second: false, third: true }, runsScored: 0, outsAdded: 0 })
    expect(advanceOnQuickWalk(이루).bases).toEqual({ first: true, second: true, third: false })
    expect(advanceOnQuickWalk(일삼루)).toEqual({ bases: 만루, runsScored: 0, outsAdded: 0 })
    expect(advanceOnQuickWalk(만루)).toEqual({ bases: 만루, runsScored: 1, outsAdded: 0 })
  })

  it('밀어내기 주자 신원 — 루 상황과 맞고 만루면 3루 주자가 득점', () => {
    expect(forceRunners({ first: null, second: null, third: 7 }, 1)).toEqual({ runners: { first: 1, second: null, third: 7 }, scored: [] })
    expect(forceRunners({ first: 5, second: null, third: 7 }, 1)).toEqual({ runners: { first: 1, second: 5, third: 7 }, scored: [] })
    expect(forceRunners({ first: 5, second: 6, third: 7 }, 1)).toEqual({ runners: { first: 1, second: 5, third: 6 }, scored: [7] })
    // 원본 길(전원 한 루)과의 차이
    expect(shiftRunners({ first: null, second: null, third: 7 }, 1, 1)).toEqual({ runners: { first: 1, second: null, third: null }, scored: [7] })
  })
})
