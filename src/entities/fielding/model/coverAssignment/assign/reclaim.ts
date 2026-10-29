import { BASE_DEFAULT_FIELDER, basePosition, isSamePoint, ticksToReach } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  fielderArrivalTicks,
  isRunnerStopped,
  NONE,
  runnerOneMoreBaseTicks,
  runnerRemainingTicks,
  type FielderState,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { idleFielder, type CoverDraft } from '@/entities/fielding/model/coverAssignment/assign/draft'
import { baseAtPoint } from '@/entities/fielding/model/coverAssignment/coverNeed'

const PITCHER_SLOT = 0
const LAST_BASE = 3

/** b2440 — 주자 하나가 루 j 까지 걸리는 틱이 기본 야수 d 보다 긴가 */
function runnerSlowerThan(runner: RunnerState, base: number, fallbackTicks: number): boolean {
  const next = runner.startBase <= LAST_BASE ? runner.startBase + 1 : runner.startBase
  if (next !== base) return runner.targetBase === ((base + 3) & 3) && runnerOneMoreBaseTicks(runner) > fallbackTicks
  if (runner.isOut) return false
  const ticks = isRunnerStopped(runner) ? ticksToReach(runner.position, basePosition(base), runner.speed) : runnerRemainingTicks(runner)
  return ticks > fallbackTicks
}

/** b2440 — 주자 하나라도 기본 야수 d 가 루 j 에 먼저 닿는가 */
function defaultFielderBeatsARunner(runners: readonly RunnerState[], base: number, fallback: FielderState): boolean {
  const fallbackTicks = fielderArrivalTicks(fallback)
  return runners.some((runner) => runnerSlowerThan(runner, base, fallbackTicks))
}

/**
 * b23dc — 루 j 를 대신 맡은 야수 S. c == d(기본 야수)면 투수가 그 루로 가고 있을 때만 S = 투수 · +0xf0[j] = 0 (그 자리에서 적는다),
 * c ≠ d 면 S = c. 대신 선 야수가 없으면 undefined.
 */
function takeSubstitute(draft: CoverDraft, base: number): FielderState | undefined {
  const current = draft.covers[base]
  if (current === NONE) return undefined
  if (current !== BASE_DEFAULT_FIELDER[base]) return draft.working[current]
  const pitcher = draft.working[PITCHER_SLOT]
  if (pitcher === undefined || baseAtPoint(pitcher.target) !== base) return undefined
  draft.covers[base] = PITCHER_SLOT
  return pitcher
}

/** S.vt18()(목표점에 있음) && d AI == 0 && 주자 하나라도 d 가 먼저 닿고, S 가 AI 8 이 아니다(b2536) */
function canReclaim(substitute: FielderState, fallback: FielderState | undefined, runners: readonly RunnerState[], base: number): boolean {
  if (!isSamePoint(substitute.position, substitute.target)) return false
  if (fallback === undefined || fallback.aiState !== AI_STATE.IDLE) return false
  if (!defaultFielderBeatsARunner(runners, base, fallback)) return false
  return substitute.aiState !== AI_STATE.RUNDOWN
}

/** b23dc — 쉬고 있는 기본 야수가 먼저 닿을 수 있으면 커버를 되찾는다 (대신 선 야수는 AI 0) */
export function reclaimDefaultCovers(draft: CoverDraft, runners: readonly RunnerState[]): void {
  for (let base = 0; base <= LAST_BASE; base += 1) {
    const substitute = takeSubstitute(draft, base)
    const fallbackSlot = BASE_DEFAULT_FIELDER[base]
    if (substitute === undefined || !canReclaim(substitute, draft.working[fallbackSlot], runners, base)) continue
    idleFielder(draft, substitute.slot)
    draft.covers[base] = fallbackSlot
  }
}
