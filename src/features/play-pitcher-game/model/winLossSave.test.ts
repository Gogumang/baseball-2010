import { describe, expect, it } from 'vitest'
import {
  EMPTY_DECISION_STATE,
  NO_SIDE,
  PITCHER_DECISION_CODE,
  REGULATION_LAST_INNING_INDEX,
  applyPitcherChange,
  applyRunScored,
  decisionCodeForMine,
  gameEndDecisionOf,
  outsRemainingOf,
} from '@/features/play-pitcher-game/model/winLossSave'

/** 측 0 이 수비, 측 1 이 공격인 상황을 만든다 */
const 상황 = (수비점수: number, 공격점수: number, inningIndex: number) => ({
  inningIndex,
  lastInningIndex: REGULATION_LAST_INNING_INDEX,
  offenseSide: 1,
  defenseSide: 0,
  scoreOf: (side: number) => (side === 0 ? 수비점수 : 공격점수),
  moundPitcherOf: (side: number) => (side === 0 ? 10 : 20),
})

describe('승리 투수 (0xa5c34)', () => {
  it('⚠️ 원본대로 5회까지의 득점에서는 승리 투수를 잡지 않는다', () => {
    // 이닝 인덱스 4 = 5회
    const 결과 = applyRunScored(EMPTY_DECISION_STATE, 상황(3, 1, 4))

    expect(결과.winner.side).toBe(NO_SIDE)
    // 패전 투수는 이닝 조건이 없어 그대로 잡힌다
    expect(결과.loser.side).toBe(1)
  })

  it('6회 이후에는 앞선 팀의 그 순간 마운드 투수가 승리 투수다', () => {
    const 결과 = applyRunScored(EMPTY_DECISION_STATE, 상황(3, 1, 5))

    expect(결과.winner).toEqual({ side: 0, number: 10 })
    expect(결과.loser).toEqual({ side: 1, number: 20 })
  })

  it('리드가 뒤집히면 칸을 비우고 다시 잡는다', () => {
    const 앞설때 = applyRunScored(EMPTY_DECISION_STATE, 상황(3, 1, 5))
    const 뒤집힘 = applyRunScored(앞설때, 상황(3, 5, 6))

    expect(뒤집힘.winner).toEqual({ side: 1, number: 20 })
    expect(뒤집힘.loser).toEqual({ side: 0, number: 10 })
  })

  it('동점이면 승·패 투수가 둘 다 없다', () => {
    const 결과 = applyRunScored(EMPTY_DECISION_STATE, 상황(2, 2, 7))

    expect(결과.winner.side).toBe(NO_SIDE)
    expect(결과.loser.side).toBe(NO_SIDE)
  })

  it('⚠️ 정규 9이닝 경기가 아니면 승리 투수를 아예 안 매긴다 (패전은 매긴다)', () => {
    const 결과 = applyRunScored(EMPTY_DECISION_STATE, { ...상황(3, 1, 5), lastInningIndex: 2 })

    expect(결과.winner.side).toBe(NO_SIDE)
    expect(결과.loser.side).toBe(1)
  })
})

describe('세이브 (0xa60c0)', () => {
  const 교체 = (수비: number, 공격: number, inningIndex: number, outs: number, 주자: number) =>
    applyPitcherChange(EMPTY_DECISION_STATE, {
      lastInningIndex: REGULATION_LAST_INNING_INDEX,
      inningIndex,
      outs,
      defenseSide: 0,
      offenseSide: 1,
      scoreOf: (side) => (side === 0 ? 수비 : 공격),
      moundPitcherOf: () => 10,
      runnerCount: 주자,
    })

  it('남은 아웃 수는 3·(마지막 − 지금) − 아웃 + 3 이다', () => {
    expect(outsRemainingOf({ lastInningIndex: 8, inningIndex: 8, outs: 0 })).toBe(3)
    expect(outsRemainingOf({ lastInningIndex: 8, inningIndex: 7, outs: 1 })).toBe(5)
  })

  it('리드 중이 아니면 세이브 상황이 아니다', () => {
    expect(교체(1, 3, 8, 0, 0).save.side).toBe(NO_SIDE)
  })

  it('점수차 3 · 남은 아웃 3 이상이면 코드 3 이다', () => {
    const 결과 = 교체(5, 2, 8, 0, 0)

    expect(결과.save).toEqual({ side: 0, number: 10 })
    expect(결과.saveCode).toBe(3)
  })

  it('점수차가 2 이하면 동점 주자가 대기 타석에 있는 셈이라 코드 1 로 덮인다', () => {
    expect(교체(4, 2, 8, 0, 0).saveCode).toBe(1)
  })

  it('점수차 4 이상이면 남은 아웃이 9 를 넘어야 한다 (코드 9)', () => {
    expect(교체(9, 2, 8, 0, 0).save.side).toBe(NO_SIDE)
    expect(교체(9, 2, 5, 0, 0).saveCode).toBe(9)
  })

  it('동점 주자가 대기 타석까지 와 있으면 코드 1 이 덮어쓴다', () => {
    expect(교체(9, 2, 5, 0, 5).saveCode).toBe(1)
  })
})

describe('경기 끝 반영 (0xa7de8)', () => {
  it('⚠️ 원본 버그 그대로 — state+0x64 를 지우는 코드가 없어 세이브가 붙지 않는다', () => {
    const 후보 = 상황(5, 2, 8)
    const 잡힌뒤 = applyPitcherChange(applyRunScored(EMPTY_DECISION_STATE, 후보), {
      lastInningIndex: REGULATION_LAST_INNING_INDEX,
      inningIndex: 8,
      outs: 0,
      defenseSide: 0,
      offenseSide: 1,
      scoreOf: (side) => (side === 0 ? 5 : 2),
      moundPitcherOf: () => 11,
      runnerCount: 0,
    })

    expect(잡힌뒤.save.side).toBe(0)
    expect(잡힌뒤.saveCode).toBe(3)
    // 그런데 경기 끝에서는 코드가 0 보다 커서 건너뛴다
    expect(gameEndDecisionOf(잡힌뒤).save).toBeNull()
  })

  it('측이 2 면 그 줄은 비어 있다', () => {
    const 결과 = gameEndDecisionOf(EMPTY_DECISION_STATE)

    expect(결과.winner).toBeNull()
    expect(결과.loser).toBeNull()
    expect(결과.save).toBeNull()
  })

  it('내 투수가 승리 투수면 R+0x124 가 1 이다', () => {
    const 결과 = gameEndDecisionOf(applyRunScored(EMPTY_DECISION_STATE, 상황(3, 1, 6)))

    expect(decisionCodeForMine(결과, { side: 0, number: 10 })).toBe(PITCHER_DECISION_CODE.win)
    expect(decisionCodeForMine(결과, { side: 1, number: 20 })).toBe(PITCHER_DECISION_CODE.loss)
    expect(decisionCodeForMine(결과, { side: 0, number: 99 })).toBe(PITCHER_DECISION_CODE.none)
  })
})
