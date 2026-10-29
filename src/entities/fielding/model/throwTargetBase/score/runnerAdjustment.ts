import { isRunnerStopped, runnerOneMoreBaseTicks, type RunnerState } from '@/entities/fielding/model/fieldingState'
import { INFIELD_READY_TICKS } from '@/entities/fielding/model/throwPlan'
import { rethrowTicks } from '@/entities/fielding/model/throwTargetBase/candidates/rethrow'
import { wrapBase, type BaseCandidate, type ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase/types'

/** "그 루로 던지는 사이 다른 주자가 한 루 더 간다" 감점 두 단계 (0xffff5038 / 0xffffa81c) */
const LATE_PENALTY = 45_000
const NEAR_PENALTY = 22_500
/** 그 루로 달려오는 주자 — 공 가진 야수가 루 밖이면 5000 + 루(홈은 5004), 아직 안 멈췄으면 +10000 */
const OUTSIDE_BONUS = 5000
const HOME_OUTSIDE_BONUS = 5004
const MOVING_RUNNER_BONUS = 10_000

export interface RunnerAdjustmentContext {
  readonly input: ThrowTargetInput
  readonly candidate: BaseCandidate
  readonly base: number
  /** 공 가진 야수가 어느 루 위에도 안 서 있고 투수도 아니다 (3-2 의 "밖") */
  readonly outside: boolean
}

/** 루로 달려오는 주자의 가점 */
function incomingRunnerBonus(runner: RunnerState, { base, outside }: RunnerAdjustmentContext): number {
  const outsideBonus = base === 0 ? HOME_OUTSIDE_BONUS : OUTSIDE_BONUS + base
  return (outside ? outsideBonus : 0) + (isRunnerStopped(runner) ? 0 : MOVING_RUNNER_BONUS)
}

/** 주자 하나만큼의 확실성 점수 보정 (S7 3-2) */
function adjustForRunner(context: RunnerAdjustmentContext, runner: RunnerState, termB: number): number {
  if (runner.isOut) return termB
  const { input, candidate, base, outside } = context
  const nextBase = wrapBase(runner.targetBase + 1)
  const reach = INFIELD_READY_TICKS + candidate.defTick + rethrowTicks(input, base, nextBase)
  const oneMore = runnerOneMoreBaseTicks(runner)
  if (reach + 2 >= oneMore && nextBase !== base) return termB - (reach >= oneMore ? LATE_PENALTY : NEAR_PENALTY)
  // b0026: [R+0x7c] == 루 — 홈으로 가는 주자(+0x7c = 4)는 홈(0)과 같지 않다 (원본 그대로 자르지 않는다)
  if (runner.targetBase === base) return termB + incomingRunnerBonus(runner, context)
  // 원본 그대로: b(0~3) 와 비교하는 max 라 termB 가 음수일 때만 올라간다 (사실상 무효, S7 3-2)
  if (nextBase === base && outside) return Math.max(termB, base)
  return termB
}

/** 살아 있는 주자 차례대로 확실성 점수를 보정한다 (S7 3-2) */
export function adjustForRunners(context: RunnerAdjustmentContext, termB: number): number {
  return context.input.runners.reduce((value, runner) => adjustForRunner(context, runner, value), termB)
}
