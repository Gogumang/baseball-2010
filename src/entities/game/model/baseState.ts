import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

export interface BaseState {
  readonly first: boolean
  readonly second: boolean
  readonly third: boolean
}

export const EMPTY_BASES: BaseState = { first: false, second: false, third: false }

export function runnerCountOf(bases: BaseState): number {
  return Number(bases.first) + Number(bases.second) + Number(bases.third)
}

export interface AdvanceResult {
  readonly bases: BaseState
  readonly runsScored: number
  readonly outsAdded: number
}

const MAXIMUM_OUTS_PER_INNING = 3

/**
 * 땅볼 아웃에 주자가 한 루 나가는 확률 (binary.mod 0xc11f0, 상한 0xc17ec = 5999).
 * 원본은 `아웃 < 2 && rand(0,10000) <= 5999 && 주자가 있고 앞 주자가 3루가 아님` 일 때 주자를 진루시킨다.
 * **추정**: 원본은 주자 목록의 마지막 주자 베이스를 보는데 그 순서를 확정하지 못해 "3루가 비었으면" 으로 옮겼다.
 */
export const GROUND_OUT_ADVANCE_LIMIT = 5999

/** 진루타가 될 수 있는 상황인가 */
export function canAdvanceOnGroundOut(bases: BaseState, outsBefore: number): boolean {
  return outsBefore < MAXIMUM_OUTS_PER_INNING - 1 && !bases.third && runnerCountOf(bases) > 0
}

/** 주자를 한 루씩 민다. 3루 주자는 없으므로 득점은 나오지 않는다 */
export function advanceOnGroundOut(bases: BaseState): BaseState {
  return { first: false, second: bases.first, third: bases.second }
}

/**
 * 타격 결과에 따라 주자를 진루시킨다.
 * 병살·주루사처럼 확률이 개입하는 플레이는 아직 넣지 않았다 (YAGNI).
 * 희생플라이만 예외로 넣었다 — 3루 주자가 뜬공에 들어오지 않으면 야구로 보이지 않는다.
 */
export function advanceRunners(
  bases: BaseState,
  outcome: AtBatOutcome,
  outsBefore: number,
): AdvanceResult {
  switch (outcome.kind) {
    case '홈런':
      return { bases: EMPTY_BASES, runsScored: runnerCountOf(bases) + 1, outsAdded: 0 }
    case '안타':
      return advanceForHit(bases, outcome.bases)
    case '볼넷':
      return advanceForWalk(bases)
    case '삼진':
      return { bases, runsScored: 0, outsAdded: 1 }
    case '아웃':
      return advanceForOut(bases, outcome.detail, outsBefore)
  }
}

function advanceForHit(bases: BaseState, hitBases: 1 | 2 | 3): AdvanceResult {
  if (hitBases === 3) {
    return {
      bases: { first: false, second: false, third: true },
      runsScored: runnerCountOf(bases),
      outsAdded: 0,
    }
  }
  if (hitBases === 2) {
    return {
      bases: { first: false, second: true, third: bases.first },
      runsScored: Number(bases.second) + Number(bases.third),
      outsAdded: 0,
    }
  }
  return {
    bases: { first: true, second: bases.first, third: bases.second },
    runsScored: Number(bases.third),
    outsAdded: 0,
  }
}

/** 볼넷은 밀려난 주자만 진루한다. 만루에서만 점수가 난다. */
function advanceForWalk(bases: BaseState): AdvanceResult {
  if (!bases.first) return { bases: { ...bases, first: true }, runsScored: 0, outsAdded: 0 }
  if (!bases.second) return { bases: { ...bases, second: true }, runsScored: 0, outsAdded: 0 }
  if (!bases.third) return { bases: { first: true, second: true, third: true }, runsScored: 0, outsAdded: 0 }
  return { bases, runsScored: 1, outsAdded: 0 }
}

function advanceForOut(
  bases: BaseState,
  detail: '땅볼아웃' | '뜬공아웃' | '직선타아웃',
  outsBefore: number,
): AdvanceResult {
  const canSacrifice =
    detail === '뜬공아웃' && bases.third && outsBefore < MAXIMUM_OUTS_PER_INNING - 1

  if (canSacrifice) {
    return { bases: { ...bases, third: false }, runsScored: 1, outsAdded: 1 }
  }
  return { bases, runsScored: 0, outsAdded: 1 }
}
