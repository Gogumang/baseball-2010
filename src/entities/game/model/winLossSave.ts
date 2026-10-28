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
 *
 * 사람 경기(0x51408 의 0x52096 · 0x52284)와 간이 엔진(득점 0xc0fb4·0xc1054 → 0xa5c34, 교체 0xc262c 의
 * 0xc26a2 → 0xa60c0)이 **같은 함수**를 부르므로 판정도 한 벌이다 — 그래서 `entities/game` 에 둔다.
 * (`features/play-pitcher-game/model/winLossSave` 는 옛 import 를 위한 다시 내보내기다.)
 */
import { isBugFixed } from '@/shared/config/bugfixes'

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
  /** state+0x64. 원본에는 이 칸을 0 으로 되돌리는 코드가 없다 (아래 주석, r126 확정) */
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
 *
 * **고침(`bugfixes.json` B-35, 기본 켬)**: 이닝 · 경기 종류 문을 걷는다 — 승리 투수도 패전 투수처럼 **모든 득점마다** 다시 본다.
 * 곧 이긴 팀이 마지막으로 리드를 잡은 순간 그 팀 마운드에 있던 투수가 승리 투수다(원본에 없는 "선발 5이닝" 은 넣지 않는다 —
 * 원본 식 그대로 문만 연 가장 작은 고침). 굴림 없음. 6회 이후 득점이 있던 경기에서도 승리 투수가 앞 이닝의 리드 투수로 바뀔 수 있다.
 *
 * 2026-10-15 r79 다시 확인: 플레이 점검(r77)의 일반모드 2:5 패배(이긴 팀 1회 5점 · 진 팀 4회 2점 · 6회 뒤 무득점)에서
 * 결과 판 승리투수 칸이 빈 것은 이 빈틈 그대로다 — 0xa5cf6~0xa5d12 가 이닝 index ≤ 4 · state+0x69 ≠ 8 이면 승리 토막을
 * 통째로 건너뛰고, 경기 끝 0xa7de8(0xa7dea~0xa7e0e)은 칸을 읽기만 해 측 2 면 넘어가며(채우는 대체 길 없음),
 * 끝 판 그리기 0x4fe9c 도 0x5026e `cmp r4,#2` 로 측 2 면 이름을 안 그린다.
 */
export function applyRunScored(state: DecisionState, input: RunScoredInput): DecisionState {
  const { offenseSide, defenseSide, scoreOf, moundPitcherOf } = input

  let winner = state.winner
  // 고침(B-35): 이닝 · 경기 종류 문을 걷어 패전 투수와 같은 셈으로 — 앞선 팀이 리드를 잡은 순간의 마운드 투수가 승리 투수다
  const canDecideWinner =
    isBugFixed('B-35') || (input.inningIndex >= WIN_PITCHER_FROM_INNING_INDEX && input.lastInningIndex === REGULATION_LAST_INNING_INDEX)
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
  const save = state.save.side !== NO_SIDE && scoreOf(state.save.side) <= scoreOf(1 - state.save.side) ? NO_PITCHER_OF_RECORD : state.save

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
export function outsRemainingOf(input: { lastInningIndex: number; inningIndex: number; outs: number }): number {
  return 3 * (input.lastInningIndex - input.inningIndex) - input.outs + 3
}

/**
 * 투수가 **올라오는 그 순간 한 번** 세이브 후보를 잡는다 (0xa60c0).
 * 요건은 실제 야구 규칙 그대로이고, 3번(동점 주자 대기)이 다른 둘을 **덮어쓴다**.
 *
 * **고침(B-10)**: 원본은 세이브 상황이 아닌 교체면 아무것도 안 해 **앞서 내려간 투수가 후보로 남는다**(원본은 어차피
 * 세이브를 안 적어 드러나지 않았다). 고친 길은 경기 끝에 코드를 안 보므로, 같은 측 투수가 세이브 상황이 아닐 때 올라오면
 * 후보를 지운다 — 세이브는 리드를 지키며 **경기를 끝낸** 투수에게만 간다.
 */
export function applyPitcherChange(state: DecisionState, input: SaveChanceInput): DecisionState {
  const defense = input.scoreOf(input.defenseSide)
  const offense = input.scoreOf(input.offenseSide)
  // 고침(B-10): 세이브 상황이 아닌데 후보 측이 투수를 바꾸면 앞 후보는 경기를 끝내지 못하므로 지운다
  const noSaveChance = (): DecisionState =>
    isBugFixed('B-10') && state.save.side === input.defenseSide ? { ...state, save: NO_PITCHER_OF_RECORD } : state
  if (defense <= offense) return noSaveChance()

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
  if (!qualifies && code === 0) return noSaveChance()

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
 * **원본 버그(B-10, r126 확정)**: `state+0x64` 를 0 으로 되돌리는 코드가 원본 어디에도 없다.
 * 세이브 후보가 한 번이라도 잡히면 코드가 1·3·9 로 남고, 경기 끝의 `코드 > 0 이면 건너뜀` 에 걸려
 * **세이브가 한 번도 기록되지 않는다** (S1 4-1). 원본 길은 후보가 있어도 거의 늘 `save: null` 을 돌려준다.
 *
 * **고침(`bugfixes.json` B-10, 기본 켬)**: 코드 1·3·9 는 그 투수가 잡아야 할 아웃 수(동점 주자 대기 1 · 1이닝 3 · 3이닝 9)로
 * 읽힌다 — 올라올 때 남은 아웃이 그 값 이상이어야 후보가 되므로, 후보가 리드를 지키며 경기를 끝내면 요건은 저절로 채워진다.
 * 그래서 고친 길은 경기 끝에 코드를 보지 않는다(후보 · 승리 투수와 같은 번호 검사는 그대로). 굴림은 없다.
 * 근거(r126, S1 이 남긴 "memset 경유" 고리를 닫음): state 는 전역 `[0x1552d0c]` 하나로, 앱 시작 0x2ed8 의
 * 0x300a~0x301a 에서 **한 번만** 0xa4 바이트를 할당(0x1239 → 0x2ac4 가 memset 0x1400428 로 0 채움)하고
 * 생성자 0xb68a4 → 0xb6814 를 부른다. 0xb6814 는 +0x44·+0x50·+0x5c = 2 · +0x40 = 0 만 쓰고 +0x64 는 안 쓴다.
 * 0x1552d0c 에 쓰는 곳은 0x301a 하나뿐(전수)이라 경기마다 새로 지우는 일이 없다. `str …,[r,#0x64]` 전수 중
 * 전역 state 근처 것은 0x351b0 하나인데 그 대상은 구장 객체 `[장면+0xf10]` 이다. 0xa6168 이 쓰는 코드는
 * a6118/a6120/a613c 갈래만 지나 늘 1 이상이다 — 그래서 +0x5c 가 2 가 아니면 +0x64 > 0 이다.
 */
export function gameEndDecisionOf(state: DecisionState): GameEndDecision {
  const winner = state.winner.side === NO_SIDE ? null : state.winner
  const loser = state.loser.side === NO_SIDE ? null : state.loser
  const hasSave =
    state.save.side !== NO_SIDE && !(winner !== null && winner.number === state.save.number) && (isBugFixed('B-10') || state.saveCode <= 0)
  return { winner, loser, save: hasSave ? state.save : null }
}

/** 평가 객체 `R+0x124` 에 들어가는 값 — 1 승 · 2 패 · 3 세이브 · 0 없음 (0xa7de8, P1 5-1) */
export const PITCHER_DECISION_CODE = { none: 0, win: 1, loss: 2, save: 3 } as const

/** 내 투수(측·등번호가 같은 사람)가 무엇으로 적히는가 */
export function decisionCodeForMine(decision: GameEndDecision, mine: { readonly side: number; readonly number: number }): number {
  const matches = (record: PitcherOfRecord | null) => record !== null && record.side === mine.side && record.number === mine.number
  if (matches(decision.winner)) return PITCHER_DECISION_CODE.win
  if (matches(decision.loser)) return PITCHER_DECISION_CODE.loss
  if (matches(decision.save)) return PITCHER_DECISION_CODE.save
  return PITCHER_DECISION_CODE.none
}
