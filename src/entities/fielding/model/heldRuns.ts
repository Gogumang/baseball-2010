import type { RunnerState } from '@/entities/fielding/model/fieldingState'

/**
 * 2아웃 득점 보류 — `state[0]` (S2 ②절, 확정).
 *
 * **P2 5b 의 설명은 방향이 반대였다**: 메시지 `0x13` 은 보류가 아니라 "점수를 1 올려라" 이고,
 * 보류는 메시지를 **안 보내고** `state[0]` 만 올리는 쪽이다.
 *
 * - 주자가 홈에 닿았을 때: 아웃 ≥ 2 이고 공이 땅에 닿은 플레이인데 타자주자가 "살아서 어느 루로 가는 중"
 *   이 아니면 점수판을 올리지 않고 보류한다 (0xaa164~0xaa1c0).
 * - 매 틱 끝: 보류분이 있으면 푼다. **아웃이 3 이 되면 영영 안 푼다 = 득점 무효** (0xaa388).
 * - 플레이 초기화 0xb67d0 이 `state[0] = 0` 으로 지운다.
 */

export interface HeldRunState {
  /** state[0] — 아직 점수판에 안 올린 보류 득점 개수 */
  readonly heldRuns: number
  /** 실제로 점수판에 올라간 득점 */
  readonly scoreboardRuns: number
}

export const EMPTY_HELD_RUNS: HeldRunState = { heldRuns: 0, scoreboardRuns: 0 }

export interface HomeArrivalInput {
  /** state[6] 아웃 수 */
  readonly outs: number
  /** state[0x1e] — 공이 땅에 닿았거나 잡혔음 */
  readonly ballOnGround: boolean
  /** 0번 주자 칸(타자주자 자리). 없으면 undefined */
  readonly batterRunner: RunnerState | undefined
  /** 홈에 닿은 주자가 0번 주자 자신인가 (0xaa18a) */
  readonly scoringRunnerIsBatterRunner: boolean
}

/**
 * 주자가 홈에 도착했을 때. 즉시 득점이면 `scoreboardRuns` 가, 보류면 `heldRuns` 가 1 늘어난다.
 */
export function onRunnerReachesHome(state: HeldRunState, input: HomeArrivalInput): HeldRunState {
  if (shouldHoldRun(input)) return { ...state, heldRuns: state.heldRuns + 1 }
  return { ...state, scoreboardRuns: state.scoreboardRuns + 1 }
}

export function shouldHoldRun(input: HomeArrivalInput): boolean {
  if (input.outs <= 1) return false
  if (!input.ballOnGround) return false
  if (input.scoringRunnerIsBatterRunner) return false
  const batterRunner = input.batterRunner
  if (batterRunner === undefined) return true
  // "살아서 어느 루로 가는 중" 이 아니면 보류 — 목표 루 ≤ 0 · 타자주자 표시 꺼짐 · 아웃 중 하나
  return batterRunner.targetBase <= 0 || !batterRunner.isBatterRunner || batterRunner.isOut
}

export interface HeldRunReleaseInput {
  readonly outs: number
  readonly ballOnGround: boolean
  readonly batterRunner: RunnerState | undefined
  /** 0xaa05c — 아직 정리가 안 끝난 주자가 하나라도 있나 */
  readonly someRunnerStillActive: boolean
}

/**
 * 매 틱 끝의 보류 해제 (0xaa34c).
 * 아웃이 3 이상이면 절대 풀지 않는다 — 다음 플레이 초기화가 `state[0]` 을 지우므로 **그 득점은 무효**다.
 */
export function releaseHeldRuns(state: HeldRunState, input: HeldRunReleaseInput): HeldRunState {
  if (state.heldRuns <= 0) return state
  if (input.someRunnerStillActive && stillWaiting(input)) return state
  if (input.outs > 2) return state
  return { heldRuns: 0, scoreboardRuns: state.scoreboardRuns + state.heldRuns }
}

function stillWaiting(input: HeldRunReleaseInput): boolean {
  const batterRunner = input.batterRunner
  if (batterRunner === undefined) return false
  return batterRunner.isOut || batterRunner.targetBase <= 0 || !input.ballOnGround
}

/** 플레이 초기화 0xb67d0 — 보류분을 버린다 */
export function resetHeldRuns(state: HeldRunState): HeldRunState {
  return { heldRuns: 0, scoreboardRuns: state.scoreboardRuns }
}

/**
 * 타석 단위로 돌리는 지금의 웹 엔진에 옮길 때의 같은 결과 규칙 (S2 2-5):
 * **땅볼로 타자주자가 아웃이 되어 그 플레이에서 3아웃이 되면 주자 득점은 0** 이다.
 */
export function runsAfterTwoOutRule(
  runsScored: number,
  input: { readonly outsAfter: number; readonly ballOnGround: boolean; readonly batterRunnerOut: boolean },
): number {
  if (input.outsAfter > 2 && input.ballOnGround && input.batterRunnerOut) return 0
  return runsScored
}
