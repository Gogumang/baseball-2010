import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import {
  EMPTY_DECISION_STATE,
  NO_SIDE,
  applyPitcherChange,
  gameEndDecisionOf,
  type SaveChanceInput,
} from '@/entities/game/model/winLossSave'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 9회초 시작, 홈(1) 이 3:1 로 앞선 채 수비 — 구원 투수 등번호 `mound` */
const chance = (mound: number, scores: readonly [number, number] = [1, 3]): SaveChanceInput => ({
  lastInningIndex: 8,
  inningIndex: 8,
  outs: 0,
  defenseSide: 1,
  offenseSide: 0,
  scoreOf: (side) => scores[side] ?? 0,
  moundPitcherOf: () => mound,
  runnerCount: 0,
})

const withWinner = { ...EMPTY_DECISION_STATE, winner: { side: 1, number: 11 }, loser: { side: 0, number: 21 } }

describe('B-10 세이브', () => {
  it('원본: 후보가 잡혀도 세이브 코드가 남아 기록되지 않는다', () => {
    const state = applyPitcherChange(withWinner, chance(15))
    expect(state.save).toEqual({ side: 1, number: 15 })
    expect(state.saveCode).toBeGreaterThan(0)
    expect(gameEndDecisionOf(state).save).toBeNull()
  })

  it('고침: 리드를 지키고 끝낸 후보에게 세이브가 붙는다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-10']))
    const state = applyPitcherChange(withWinner, chance(15))
    expect(gameEndDecisionOf(state).save).toEqual({ side: 1, number: 15 })
  })

  it('고침: 세이브 상황이 아닐 때 같은 측 투수가 올라오면 앞 후보를 지운다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-10']))
    const candidate = applyPitcherChange(withWinner, chance(15))
    // 9회 2사, 8점 차 — 세이브 상황 아님
    const blowout: SaveChanceInput = { ...chance(16, [1, 9]), outs: 2 }
    const after = applyPitcherChange(candidate, blowout)
    expect(after.save.side).toBe(NO_SIDE)
    expect(gameEndDecisionOf(after).save).toBeNull()
  })

  it('고침: 상대 측 교체는 후보를 건드리지 않는다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-10']))
    const candidate = applyPitcherChange(withWinner, chance(15))
    const other = applyPitcherChange(candidate, { ...chance(30), defenseSide: 0, offenseSide: 1 })
    expect(other.save).toEqual({ side: 1, number: 15 })
  })

  it('고침이어도 승리 투수와 같은 번호면 세이브가 아니다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-10']))
    const state = applyPitcherChange(withWinner, chance(11))
    expect(gameEndDecisionOf(state).save).toBeNull()
  })
})
