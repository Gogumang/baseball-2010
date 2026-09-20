/**
 * 승·패·세이브 투수 판정 (binary.mod 초기화 0xb6814 · 득점 처리 0xa5c34 · 교체 0xa60c0 ·
 * 경기 끝 0xa7de8 — S1-win-loss-save.md 전체, 확정).
 *
 * 원본 칸:
 *   state+0x44 / +0x48  승리 투수의 **측** / 등번호
 *   state+0x50 / +0x54  패전 투수
 *   state+0x5c / +0x60  세이브 후보
 *   state+0x64          세이브 "종류" 코드 1 / 3 / 9
 * 측 **2 = 없음**이고 초기화가 셋 다 2 로 둔다.
 */

/** 측 2 = 없음 (0xb6814) */
export const NO_SIDE = 2

/** 정규 9이닝 경기의 마지막 이닝 인덱스 `state+0x69` */
export const REGULATION_LAST_INNING_INDEX = 8

/** 승리 투수를 갱신하기 시작하는 이닝 인덱스 — `이닝 index ≤ 4 면 건너뜀` (0xa5d02) */
export const WIN_PITCHER_FROM_INNING_INDEX = 5

export interface PitcherOfRecord {
  /** 0 / 1, 또는 `NO_SIDE`(2) */
  readonly side: number
  /** 그 순간 마운드에 선 투수의 등번호 (레코드 +0). 측이 2 면 뜻이 없다 */
  readonly number: number
}

export const NO_PITCHER_OF_RECORD: PitcherOfRecord = { side: NO_SIDE, number: 0 }

export interface DecisionState {
  readonly winner: PitcherOfRecord
  readonly loser: PitcherOfRecord
  readonly save: PitcherOfRecord
  /** state+0x64. ⚠️ 원본에는 이 칸을 0 으로 되돌리는 코드가 없다 (아래 주석) */
  readonly saveCode: number
}

export const EMPTY_DECISION_STATE: DecisionState = {
  winner: NO_PITCHER_OF_RECORD,
  loser: NO_PITCHER_OF_RECORD,
  save: NO_PITCHER_OF_RECORD,
  saveCode: 0,
}

export interface RunScoredInput {
  /** 0-기준 이닝 `state+0x6b` */
  readonly inningIndex: number
  /** 마지막 이닝 인덱스 `state+0x69` — 9이닝 경기면 8 */
  readonly lastInningIndex: number
  /** 공격측 번호 `state[9]` */
  readonly offenseSide: number
  /** 수비측 번호 `state[0xa]` */
  readonly defenseSide: number
  /** 측별 점수 (0xb69b0) */
  readonly scoreOf: (side: number) => number
  /** 그 측의 지금 마운드 투수 등번호 (0xae83c → 레코드 +0) */
  readonly moundPitcherOf: (side: number) => number
}

/**
 * 한 점이 들어올 때마다 부른다 (0xa5c34 의 0xa5cf6~0xa5dea).
 *
 * ⚠️ **원본 빈틈 그대로**: 승리 투수는 **6회(이닝 index ≥ 5) 이후의 득점 때만**, 그리고
 * **정규 9이닝 경기(`state+0x69 == 8`)에서만** 갱신한다. 5회까지 점수가 나고 6회 이후로
 * 한 점도 안 나면 **승리 투수가 없는 경기**가 된다 (패전 투수는 이닝 조건이 없어 정상으로 남는다).
 * 원본에 "선발 5이닝 요건"·"구원 승 인계" 같은 진짜 규칙은 없다.
 */
export function applyRunScored(state: DecisionState, input: RunScoredInput): DecisionState {
  const { offenseSide, defenseSide, scoreOf, moundPitcherOf } = input

  let winner = state.winner
  const canDecideWinner =
    input.inningIndex >= WIN_PITCHER_FROM_INNING_INDEX &&
    input.lastInningIndex === REGULATION_LAST_INNING_INDEX
  if (canDecideWinner) {
    // 이미 정해져 있는데 그 팀이 더 이상 앞서지 않으면 지운다 (0xa5d2e)
    if (winner.side !== NO_SIDE && scoreOf(winner.side) <= scoreOf(1 - winner.side)) {
      winner = NO_PITCHER_OF_RECORD
    }
    if (winner.side === NO_SIDE) {
      const defense = scoreOf(defenseSide)
      const offense = scoreOf(offenseSide)
      const side = defense > offense ? defenseSide : offense > defense ? offenseSide : NO_SIDE
      winner = side === NO_SIDE ? NO_PITCHER_OF_RECORD : { side, number: moundPitcherOf(side) }
    }
  }

  // 패전 투수 — 이닝·경기 종류 조건이 **없다** (0xa5d6c)
  let loser = state.loser
  if (loser.side !== NO_SIDE && scoreOf(loser.side) >= scoreOf(1 - loser.side)) {
    loser = NO_PITCHER_OF_RECORD
  }
  if (loser.side === NO_SIDE) {
    const defense = scoreOf(defenseSide)
    const offense = scoreOf(offenseSide)
    const side = defense < offense ? defenseSide : offense < defense ? offenseSide : NO_SIDE
    loser = side === NO_SIDE ? NO_PITCHER_OF_RECORD : { side, number: moundPitcherOf(side) }
  }

  // 세이브 후보는 **무효화만** 한다 — 재지정은 다음 교체 때뿐이다 (0xa5dea)
  const save =
    state.save.side !== NO_SIDE && scoreOf(state.save.side) <= scoreOf(1 - state.save.side)
      ? NO_PITCHER_OF_RECORD
      : state.save

  return { ...state, winner, loser, save }
}

export interface SaveChanceInput {
  readonly lastInningIndex: number
  readonly inningIndex: number
  readonly outs: number
  readonly defenseSide: number
  readonly offenseSide: number
  readonly scoreOf: (side: number) => number
  readonly moundPitcherOf: (side: number) => number
  /** 루상 주자 수 (0xa9598) */
  readonly runnerCount: number
}

/** 남은 아웃 수 `3·(마지막 − 지금) − 아웃 + 3` (0xa60c0) */
export function outsRemainingOf(input: {
  lastInningIndex: number
  inningIndex: number
  outs: number
}): number {
  return 3 * (input.lastInningIndex - input.inningIndex) - input.outs + 3
}

/**
 * 투수가 **올라오는 그 순간 한 번** 세이브 후보를 잡는다 (0xa60c0).
 * 요건은 실제 야구 규칙 그대로이고, 3번(동점 주자 대기)이 다른 둘을 **덮어쓴다**.
 */
export function applyPitcherChange(state: DecisionState, input: SaveChanceInput): DecisionState {
  const defense = input.scoreOf(input.defenseSide)
  const offense = input.scoreOf(input.offenseSide)
  if (defense <= offense) return state

  const remaining = outsRemainingOf(input)
  const gap = defense - offense
  let code = 0
  let qualifies = false
  if (gap > 3) {
    if (remaining > 8) {
      code = 9
      qualifies = true
    }
  } else if (remaining > 2) {
    code = 3
    qualifies = true
  }
  if (defense <= offense + input.runnerCount + 2 && remaining > 0) code = 1
  if (!qualifies && code === 0) return state

  return {
    ...state,
    save: { side: input.defenseSide, number: input.moundPitcherOf(input.defenseSide) },
    saveCode: code,
  }
}

export interface GameEndDecision {
  readonly winner: PitcherOfRecord | null
  readonly loser: PitcherOfRecord | null
  readonly save: PitcherOfRecord | null
}

/**
 * 경기 끝에 실제로 기록되는 셋 (0xa7de8 의 0xa7e0e·0xa7e9a~0xa7ed8).
 *
 * ⚠️ **원본 버그 그대로 (유력)**: `state+0x64` 를 0 으로 되돌리는 코드가 원본 어디에도 없다.
 * 세이브 후보가 한 번이라도 잡히면 코드가 1·3·9 로 남고, 경기 끝의 `코드 > 0 이면 건너뜀` 에 걸려
 * **세이브가 한 번도 기록되지 않는다** (S1 4-1). 고치지 않는다 — 그래서 이 함수는
 * 후보가 있어도 거의 늘 `save: null` 을 돌려준다.
 */
export function gameEndDecisionOf(state: DecisionState): GameEndDecision {
  const winner = state.winner.side === NO_SIDE ? null : state.winner
  const loser = state.loser.side === NO_SIDE ? null : state.loser
  const hasSave =
    state.save.side !== NO_SIDE &&
    !(winner !== null && winner.number === state.save.number) &&
    state.saveCode <= 0
  return { winner, loser, save: hasSave ? state.save : null }
}

/** 평가 객체 `R+0x124` 에 들어가는 값 — 1 승 · 2 패 · 3 세이브 · 0 없음 (0xa7de8, P1 5-1) */
export const PITCHER_DECISION_CODE = { none: 0, win: 1, loss: 2, save: 3 } as const

/** 내 투수(측·등번호가 같은 사람)가 무엇으로 적히는가 */
export function decisionCodeForMine(
  decision: GameEndDecision,
  mine: { readonly side: number; readonly number: number },
): number {
  const matches = (record: PitcherOfRecord | null) =>
    record !== null && record.side === mine.side && record.number === mine.number
  if (matches(decision.winner)) return PITCHER_DECISION_CODE.win
  if (matches(decision.loser)) return PITCHER_DECISION_CODE.loss
  if (matches(decision.save)) return PITCHER_DECISION_CODE.save
  return PITCHER_DECISION_CODE.none
}
