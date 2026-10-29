import { baseAtPoint, claimCoverOfBase } from '@/entities/fielding/model/coverAssignment'
import { basePosition, horizontalDistance, ticksToReach } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState, NONE, fielderArrivalTicks } from '@/entities/fielding/model/fieldingState'
import { throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { MINIMUM_THROW_DISTANCE } from '@/features/defense-play/model/defensePlay/constants'
import { isCoverState } from '@/features/defense-play/model/defensePlay/fielders/moveFielder'
import { wrapBase } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import { rollThrowBall } from '@/features/defense-play/model/defensePlay/throw/throwBall'
import type { ThrowChooser } from '@/features/defense-play/model/defensePlay/throw/throwChooser'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **루로 보내기 0xb2c90**(플레이.vt58, 인자 루·특수) — 성공(1)이면 참. 직접 뜬 것:
 * ```
 * b2cb4: C = +0xf0[루 & 3]
 * b2cc4: C == −1 → 공 가진 야수 AI 상태 6 · vt48(루) = 직접 들고 뛴다 ; 0
 * b2cf0: C.vt68()(목표 루) ≠ 루 → 0
 * b2d14: t_run = 공가진야수.vt1c(루 좌표) ; t_throw = 공가진야수.vtb8(C 목표점) ; t_recv = C.vtc0()
 * b2d64: t_run ≤ max(t_throw, t_recv) → 0xb2a48(P, +0x130, 루) 직접 밟으러 간다 ; 1
 * b2d7e: 거리(공가진야수, C) > 600 이고 C ≠ 자신 → +0x154 = C, vt5c(C, 특수) = 0xb2e38 송구 ;
 * b2df4:   그 결과가 참이고 공가진야수가 커버 상태(0xa0ff4: AI 2~5)도 AI 9 도 아니면 AI 0 ; 그 결과
 *        아니면 아무것도 안 함 ; 0
 * 0xb2a48(P, f, 루): 옛 커버 C(−1 · f 가 아니면) AI 0 ; +0xf0[루] = f ; f.vt48(루) ; f AI 루 + 2
 * ```
 * 실패(0)하면 0xafa60 은 +0x128 을 안 지워 다음 틱에 다시 고른다.
 * AI 0 은 플레이 틱 b476a 가 야수를 시작 자리 0xd86ec 로 걷게 한다(`moveFielder`).
 */
export function rollSendToBase(
  s: DefensePlayState,
  t: TickFrame,
  fromSlot: number,
  base: number,
  chooser: ThrowChooser,
  cpuSpecial: boolean,
): boolean {
  const holder = s.fielders[fromSlot]
  if (holder === undefined) return false
  const coverSlot = coverSlotOf(s, base)
  if (coverSlot === NONE) {
    carryBallToBase(s, t, holder, base)
    return false
  }
  const cover = s.fielders[coverSlot]
  // b2cf0 C.vt68() = 0xa0b4c — 목표점(+0x2c)이 어느 루 좌표와 같은가(아니면 −1). 칸으로 든 목표 루가 아니라 목표점으로 본다(r180)
  if (cover === undefined || baseAtPoint(cover.target) !== base) return false
  return rollRunOrThrow(s, t, { fromSlot, coverSlot, base, chooser, cpuSpecial })
}

interface BaseOrder {
  readonly fromSlot: number
  readonly coverSlot: number
  readonly base: number
  readonly chooser: ThrowChooser
  readonly cpuSpecial: boolean
}

/** b2d14~b2df4 — 먼저 닿으면 직접 밟고(0xb2a48), 아니면 600 넘게 떨어진 커버에게 던진다(0xb2e38) */
function rollRunOrThrow(s: DefensePlayState, t: TickFrame, order: BaseOrder): boolean {
  const { fromSlot, coverSlot, base } = order
  const holder = s.fielders[fromSlot]
  const cover = s.fielders[coverSlot]
  const runTicks = ticksToReach(holder.position, basePosition(base), holder.speed)
  if (canReachBaseFirst(holder, cover, runTicks)) {
    if (coverSlot !== fromSlot) stepOnBaseYourself(s, t, fromSlot, base, runTicks)
    return true
  }
  if (coverSlot === fromSlot || isTooCloseToThrow(holder, cover)) return false
  const thrown = rollThrowBall(s, t, fromSlot, coverSlot, base, order.chooser, order.cpuSpecial)
  if (thrown) returnThrowerToIdle(s, fromSlot)
  return thrown
}

/** b2cb4: C = +0xf0[루 & 3] */
function coverSlotOf(s: DefensePlayState, base: number): number {
  return s.play.coverOfBase[wrapBase(base)] ?? NONE
}

/** b2d14~b2d64: t_run ≤ max(t_throw, t_recv) — 공 가진 야수가 송구 · 받기보다 먼저 루에 닿는다 */
function canReachBaseFirst(holder: FielderState, cover: FielderState, runTicks: number): boolean {
  return runTicks <= Math.max(throwTicksTo(holder, cover.target), fielderArrivalTicks(cover))
}

/** b2d7e: 거리(공가진야수, C) ≤ 600 이면 던지지 않는다 */
function isTooCloseToThrow(holder: FielderState, cover: FielderState): boolean {
  return horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE
}

/** 공 든 채 루로 (AI 상태 6 · vt48(루)). 같은 루로 이미 가고 있으면 새로 적지 않는다 — 0xafa60 이 매 틱 다시 고른다 */
function carryBallToBase(s: DefensePlayState, t: TickFrame, holder: FielderState, base: number): void {
  if (holder.aiState === AI_STATE.CARRY && holder.targetBase === base) return
  const basePoint = basePosition(base)
  s.fielders = s.fielders.map((fielder) =>
    fielder.slot === holder.slot ? { ...fielder, target: basePoint, targetBase: base, aiState: AI_STATE.CARRY } : fielder,
  )
  s.log.push(`${t.tick}틱 ${holder.slot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
}

/**
 * 0xb2a48 — 공 가진 야수가 그 루의 커버가 된다(`claimCoverOfBase`). 옛 커버는 AI 0 만 — 목표 · 목표 루(+0x7c)는 그대로
 * 두고 다음 걸음 전 AI 0 b476a 가 vtcc 면 시작 자리로 고친다(r180 — 예전 웹은 여기서 시작 자리 · 목표 루 −1 로 바로 적었다)
 */
function stepOnBaseYourself(s: DefensePlayState, t: TickFrame, fromSlot: number, base: number, runTicks: number): void {
  const claimed = claimCoverOfBase(s.play, s.fielders, fromSlot, base)
  s.play = claimed.play
  s.fielders = claimed.fielders
  if (runTicks > 0) s.log.push(`${t.tick}틱 ${fromSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
}

/** b2df8~b2e14: 던진 야수가 커버(AI 2~5)도 AI 9 도 아니면 AI 0 — 시작 자리로 돌아간다 */
function returnThrowerToIdle(s: DefensePlayState, fromSlot: number): void {
  s.fielders = s.fielders.map((fielder) =>
    fielder.slot === fromSlot && !isCoverState(fielder.aiState) && fielder.aiState !== AI_STATE.RECEIVE
      ? { ...fielder, aiState: AI_STATE.IDLE }
      : fielder,
  )
}
