import { basePosition, ticksToReach, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import {
  legTotalTicksOf,
  NONE,
  remainingTicksOf,
  runnerRemainingTicks,
  type DefenseContext,
  type FielderState,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { throwTicksTo, throwTicksToFielder } from '@/entities/fielding/model/throwPlan'

/**
 * 협살(런다운) — AI 상태 8 (0xb48b6) · 대상 고르기 0xb398c · 계획 0xb3a04 · 시작 0xb3a94 (S8 1절, 확정).
 *
 * **사람이 수비하면 협살이 절대 안 일어난다**: 시작 조건이 `state[0x31 + 수비측] == 1`(= CPU) 이다 (S8 1-4).
 */

/** 다음 루까지 **남은** 비율이 이 값을 넘는 주자를 노린다 (0xb39d8 `cmp #0x23`, 즉시값으로 박혀 있다) */
export const RUNDOWN_REMAINING_PERCENT = 35

/** 공을 쥔 쪽이 보는 여유 (0xb49d2 `adds r0,#5`) */
const HOLDER_MARGIN_TICKS = 5
/** 공이 없는 쪽이 보는 여유 (0xb4a90 `adds r3,#4`) — 서로 다르다. 원본 그대로 */
const FREE_MARGIN_TICKS = 4

/**
 * 협살 대상 주자 고르기 0xb398c — **뒤 주자부터** 보며 `남은 틱 / 전체 틱 > 35%` 인 첫 주자.
 *
 * **P2 정정(S8 정정 3)**: "35% 넘게 **간** 주자" 가 아니라 "35% 넘게 **남은**" 주자다.
 * 즉 루에 35% 미만으로 붙은 주자는 협살하지 않는다.
 */
export function chooseRundownRunner(runners: readonly RunnerState[]): number {
  for (let index = runners.length - 1; index >= 0; index -= 1) {
    const runner = runners[index]
    if (runner === undefined) continue
    if (runner.isOut) continue
    if (runner.settled) continue
    const remaining = runnerRemainingTicks(runner)
    const whole = legTotalTicksOf(runner)
    if (whole === 0) continue
    if (Math.trunc((100 * remaining) / whole) > RUNDOWN_REMAINING_PERCENT) return index
  }
  return NONE
}

/** 협살 기록칸 P+0x1ec ~ +0x1f3 (8바이트) */
export interface RundownPlan {
  /** +0x1ec 주자의 현재 루를 커버하는 야수 번호 */
  readonly backFielder: number
  /** +0x1ed 주자의 목표 루를 커버하는 야수 번호 */
  readonly frontFielder: number
  /** +0x1ee 주자의 현재 루 */
  readonly backBase: number
  /** +0x1ef 주자의 목표 루 (현재 루와 같으면 +1) */
  readonly frontBase: number
  /** +0x1f0 협살 대상 주자 번호 */
  readonly runnerIndex: number
  /** +0x1f1 두 야수 중 지금 공을 쥔 쪽 (0/1), 없으면 −1 */
  readonly holderSide: number
}

export const NO_RUNDOWN: RundownPlan = {
  backFielder: NONE,
  frontFielder: NONE,
  backBase: NONE,
  frontBase: NONE,
  runnerIndex: NONE,
  holderSide: NONE,
}

/** 협살 계획 만들기 0xb3a04 */
export function buildRundownPlan(context: DefenseContext, runnerIndex: number): RundownPlan {
  if (runnerIndex === NONE) return NO_RUNDOWN
  const runner = context.runners[runnerIndex]
  if (runner === undefined) return NO_RUNDOWN
  const backBase = runner.startBase
  const frontBase = runner.targetBase === backBase ? runner.targetBase + 1 : runner.targetBase
  const backFielder = context.play.coverOfBase[(((backBase % 4) + 4) % 4)] ?? NONE
  const frontFielder = context.play.coverOfBase[(((frontBase % 4) + 4) % 4)] ?? NONE
  const holderSlot = context.play.ballHolderSlot
  const holderSide = backFielder === holderSlot ? 0 : frontFielder === holderSlot ? 1 : NONE
  return { backFielder, frontFielder, backBase, frontBase, runnerIndex, holderSide }
}

/**
 * 협살을 시작할 수 있는가 (0xb3fa8 + 0xb4358).
 * 대상 주자가 있고, 두 루 모두 커버 야수가 있고, **공을 쥔 야수가 그 두 명 중 하나**여야 하며,
 * **수비가 CPU 일 때만** 걸린다.
 */
export function canStartRundown(context: DefenseContext, defenseIsCpu: boolean): boolean {
  if (!defenseIsCpu) return false
  const runnerIndex = chooseRundownRunner(context.runners)
  if (runnerIndex === NONE) return false
  const plan = buildRundownPlan(context, runnerIndex)
  if (plan.backFielder === NONE || plan.frontFielder === NONE) return false
  return plan.holderSide !== NONE
}

/** 협살 중인 야수가 이번 틱에 할 일 (0xb48b6) */
export type RundownAction =
  | { readonly kind: '협살해제' }
  /** 아직 포구 전 — 공 쪽으로 이동 */
  | { readonly kind: '공쫓기'; readonly target: WorldPoint }
  /** 주자를 쫓아가 태그 (vt4c) */
  | { readonly kind: '주자추적'; readonly runnerIndex: number }
  /** 짝 야수에게 송구 (플레이.vt5c) */
  | { readonly kind: '짝에게송구'; readonly toSlot: number }
  /** 동작을 멈추고 대기 (vt10) */
  | { readonly kind: '대기' }
  /** 내 루로 가서 밟기 (vt48) */
  | { readonly kind: '루로'; readonly base: number }

export interface RundownTickInput extends DefenseContext {
  readonly plan: RundownPlan
  /** 이 야수 번호 */
  readonly slot: number
  /** 공 객체의 목표점 (아직 포구 전일 때 쫓아갈 곳) */
  readonly ballTarget: WorldPoint
}

/**
 * 협살 한 틱. 공을 쥔 쪽과 아닌 쪽의 여유 틱이 **5 와 4 로 다르다** — 원본 그대로 옮긴다.
 */
export function rundownAction(input: RundownTickInput): RundownAction {
  const { plan, slot, play, fielders, runners } = input
  if (plan.runnerIndex === NONE) return { kind: '협살해제' }
  if (plan.backFielder !== slot && plan.frontFielder !== slot) return { kind: '협살해제' }
  if (chooseRundownRunner(runners) === NONE) return { kind: '협살해제' }

  const runner = runners[plan.runnerIndex]
  const partnerSlot = slot === plan.backFielder ? plan.frontFielder : plan.backFielder
  const partner = fielders[partnerSlot]
  const self = fielders[slot]
  if (runner === undefined || partner === undefined || self === undefined) return { kind: '협살해제' }

  if (slot === play.ballHolderSlot) {
    // ── 내가 공을 쥐었다 ──
    if (!self.holdingBall) return { kind: '공쫓기', target: input.ballTarget }
    const coversBack = slot === (play.coverOfBase[(((runner.startBase % 4) + 4) % 4)] ?? NONE)
    const safe =
      ticksToReach(runner.position, partner.position, runner.speed) >
      throwTicksToFielder(partner, self) + HOLDER_MARGIN_TICKS
    if (coversBack || safe) return { kind: '주자추적', runnerIndex: plan.runnerIndex }
    if (play.held) return { kind: '짝에게송구', toSlot: partnerSlot }
    return { kind: '대기' }
  }

  // ── 내가 공이 없다 ──
  const runnerTicks = ticksToReach(runner.position, self.position, runner.speed)
  const throwTicks = throwTicksTo(partner, self.position)
  if (runnerTicks > throwTicks + FREE_MARGIN_TICKS) return { kind: '주자추적', runnerIndex: plan.runnerIndex }
  if (runnerTicks > throwTicks) return { kind: '대기' }
  return { kind: '루로', base: slot === plan.backFielder ? plan.backBase : plan.frontBase }
}

/**
 * 협살 종료 0xb26b8 — 기록칸을 지우고 상태 8 인 야수를 전부 상태 0 으로 되돌린다.
 * 부르는 곳은 아웃 판정(0xb3946) · 플레이 틱(0xb4336) · 상태 8 자신(0xb4912).
 */
export function endRundown(fielders: readonly FielderState[]): readonly FielderState[] {
  return fielders.map((fielder) => (fielder.aiState === 8 ? { ...fielder, aiState: 0 } : fielder))
}

/** 협살 대상 주자의 남은 비율(%) — 화면이 "왜 이 주자인가" 를 보여 줄 때 쓴다 */
export function remainingPercentOf(runner: RunnerState): number {
  const whole = legTotalTicksOf(runner)
  if (whole === 0) return 0
  return Math.trunc((100 * runnerRemainingTicks(runner)) / whole)
}

/** 야수의 남은 이동 틱 (0xbefec) — 화면 쪽에서도 쓸 수 있게 열어 둔다 */
export function fielderRemainingTicks(fielder: FielderState): number {
  return remainingTicksOf(fielder)
}

/** 협살에서 야수가 밟으러 가는 루 좌표 */
export function rundownBasePoint(plan: RundownPlan, slot: number): WorldPoint {
  return basePosition(slot === plan.backFielder ? plan.backBase : plan.frontBase)
}
