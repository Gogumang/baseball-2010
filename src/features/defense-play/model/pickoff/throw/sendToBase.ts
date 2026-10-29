import { baseAtPoint, claimCoverOfBase } from '@/entities/fielding/model/coverAssignment'
import { basePosition, horizontalDistance, ticksToReach } from '@/entities/fielding/model/fieldGeometry'
import { acceptsTargetVt14 } from '@/entities/fielding/model/fielderPose'
import { AI_STATE, type FielderState, NONE, fielderArrivalTicks } from '@/entities/fielding/model/fieldingState'
import { throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { MINIMUM_THROW_DISTANCE } from '@/features/defense-play/model/pickoff/constants'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { wrapBase } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'
import { rollThrowBall } from '@/features/defense-play/model/pickoff/throw/throwBall'

/**
 * 받은 야수의 이어 던지기 — 루로 보내기 0xb2c90 · 송구 0xb2e38 (`runDefensePlay` 의 rollSendToBase · rollThrowBall 과 같은 갈래).
 * 커버 없음 → 공 든 채 그 루로(0) · 커버의 목표 루 ≠ 루(0) · 직접 밟는 게 빠름(1) · 600 이하 · 자기 자신(0) ·
 * 받는 야수가 1구간 틱 안에 못 닿음 → AI 9 로 미룸(1) · 그 밖 던진다(악송구 굴림 0xa1828)(1), 던진 야수는 AI 0.
 */
export function rollSendToBase(g: PickoffFrame, tick: number, base: number, chooser: string, cpuSpecial: boolean): boolean {
  const holderSlot = g.play.ballHolderSlot
  const holder = g.fielders[holderSlot]
  if (holder === undefined) return false
  const coverSlot = coverSlotOf(g, base)
  if (coverSlot === NONE) {
    carryBallToBase(g, tick, holderSlot, base)
    return false
  }
  const cover = g.fielders[coverSlot]
  // b2cf0 C.vt68() = 0xa0b4c — 목표점(+0x2c)이 어느 루 좌표와 같은가(아니면 −1). 칸으로 든 목표 루가 아니라 목표점으로 본다(r180)
  if (cover === undefined || baseAtPoint(cover.target) !== base) return false
  return rollRunOrThrow(g, tick, { holder, cover, coverSlot, base }, chooser, cpuSpecial)
}

interface BaseTarget {
  readonly holder: FielderState
  readonly cover: FielderState
  readonly coverSlot: number
  readonly base: number
}

/** b2d14~b2df4 — 먼저 닿으면 직접 밟고(0xb2a48), 아니면 600 넘게 떨어진 커버에게 던진다(0xb2e38) */
function rollRunOrThrow(g: PickoffFrame, tick: number, target: BaseTarget, chooser: string, cpuSpecial: boolean): boolean {
  const { holder, cover, coverSlot, base } = target
  const holderSlot = g.play.ballHolderSlot
  const runTicks = ticksToReach(holder.position, basePosition(base), holder.speed)
  if (runTicks <= Math.max(throwTicksTo(holder, cover.target), fielderArrivalTicks(cover))) {
    if (coverSlot !== holderSlot) stepOnBaseYourself(g, tick, holderSlot, base, runTicks)
    return true
  }
  if (coverSlot === holderSlot || isTooCloseToThrow(holder, cover)) return false
  // b2d7e~b2dea: 거리(공가진야수, C) 0xbf9f0 > 600(b2dbe~b2dc8) · C ≠ +0x130(b2dd4) 관문(`isTooCloseToThrow`) 뒤
  //   +0x154 = C(b2dde) · vt5c(C, 특수) = 0xb2e38(b2de4~b2dea)
  const thrown = rollThrowBall(g, tick, coverSlot, base, chooser, cpuSpecial)
  if (!thrown) return false
  returnThrowerToIdle(g, holderSlot)
  return true
}

/** b2cb4: C = +0xf0[루 & 3] */
function coverSlotOf(g: PickoffFrame, base: number): number {
  return g.play.coverOfBase[wrapBase(base)] ?? NONE
}

/** b2d7e: 거리(공가진야수, C) ≤ 600 이면 던지지 않는다 */
function isTooCloseToThrow(holder: FielderState, cover: FielderState): boolean {
  return horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE
}

/** b2cc4 — 상태 6 · vt48(루) (r180 — 예전 웹은 AI 를 안 바꿨다). vt48 0xa0a18 → vt14 — 관문(잠금 · vtc8)이 막으면 목표는 그대로(r196) */
function carryBallToBase(g: PickoffFrame, tick: number, holderSlot: number, base: number): void {
  const basePoint = basePosition(base)
  g.fielders = g.fielders.map((fielder) => {
    if (fielder.slot !== holderSlot) return fielder
    if (!acceptsTargetVt14(fielder)) return { ...fielder, aiState: AI_STATE.CARRY }
    return { ...fielder, target: basePoint, targetBase: base, aiState: AI_STATE.CARRY }
  })
  g.log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
}

/**
 * 0xb2a48(P, f, 루) — 옛 커버 C(f 가 아니면) AI 0 **만**(목표 · 목표 루 그대로) · +0xf0[루] = f · f.vt48(루) · f AI 루 + 2.
 * C == f 면 아무것도 안 한다(b2a6e) (`claimCoverOfBase`, r180 — 예전 웹은 옛 커버를 시작 자리 · 목표 루 −1 로 바로 적었다)
 */
function stepOnBaseYourself(g: PickoffFrame, tick: number, holderSlot: number, base: number, runTicks: number): void {
  const claimed = claimCoverOfBase(g.play, g.fielders, holderSlot, base)
  g.play = claimed.play
  g.fielders = claimed.fielders
  if (runTicks > 0) g.log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
}

/** b2df8~b2e14 — 던진 야수가 커버(0xa0ff4 — AI 2~5)도 AI 9 도 아니면 AI 0 (시작 자리로). 미룬 송구는 AI 9 라 그대로 */
function returnThrowerToIdle(g: PickoffFrame, holderSlot: number): void {
  g.fielders = g.fielders.map((fielder) => {
    if (fielder.slot !== holderSlot) return fielder
    const keeps = (fielder.aiState >= AI_STATE.COVER_HOME && fielder.aiState <= AI_STATE.COVER_THIRD) || fielder.aiState === AI_STATE.RECEIVE
    return keeps ? fielder : { ...fielder, aiState: AI_STATE.IDLE }
  })
}
