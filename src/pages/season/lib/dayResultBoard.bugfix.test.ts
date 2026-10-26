import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { isWinA, isWinB, showsResultMark } from '@/pages/season/lib/dayResultBoard'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 동점 = { teamA: 0, teamB: 1, scoreA: 2, scoreB: 2 }
const 승부 = { teamA: 0, teamB: 1, scoreA: 3, scoreB: 2 }

describe('B-68 동점 경기는 두 팀 모두 LOSE', () => {
  it('원본: 동점도 두 칸에 그림을 그리고 둘 다 LOSE', () => {
    expect(showsResultMark(동점)).toBe(true)
    expect([isWinA(동점), isWinB(동점)]).toEqual([false, false])
  })

  it('고침: 동점 줄은 WIN/LOSE 칸을 비운다 — 승부가 난 줄은 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-68']))
    expect(showsResultMark(동점)).toBe(false)
    expect(showsResultMark(승부)).toBe(true)
  })
})
