import { baseAtPoint, claimCoverOfBase } from '@/entities/fielding/model/coverAssignment'
import { basePosition, horizontalDistance, ticksToReach } from '@/entities/fielding/model/fieldGeometry'
import { acceptsTargetVt14 } from '@/entities/fielding/model/fielderPose'
import { AI_STATE, type FielderState, NONE, fielderArrivalTicks } from '@/entities/fielding/model/fieldingState'
import { throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { MINIMUM_THROW_DISTANCE } from '@/features/defense-play/model/runnerPlay/constants'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { wrapBase } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { rollThrowBall } from '@/features/defense-play/model/runnerPlay/throw/throwBall'
import type { ThrowChooser } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

/**
 * 루로 보내기 0xb2c90(P, 루, 특수) — 성공(1)이면 참 (`runDefensePlay` 의 `rollSendToBase` 와 같은 갈래).
 * 커버 없음 → 공 가진 야수가 들고 뛴다(0) · 커버 목표 루 ≠ 루(0) · 직접 밟는 게 빠름(1) · 600 이하 · 자기 자신(0) ·
 * 그 밖에는 송구 0xb2e38 → 0xa1620(악송구 굴림 0xa1828)(1).
 */
export function rollSendToBase(g: RunnerPlayFrame, tick: number, base: number, byHuman: ThrowChooser, cpuSpecial: boolean): boolean {
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
  if (baseAtPoint(cover.target) !== base) return false
  return rollRunOrThrow(g, tick, { holder, cover, coverSlot, base }, byHuman, cpuSpecial)
}

interface BaseTarget {
  readonly holder: FielderState
  readonly cover: FielderState
  readonly coverSlot: number
  readonly base: number
}

/** b2d14~b2df4 — 먼저 닿으면 직접 밟고(0xb2a48), 아니면 600 넘게 떨어진 커버에게 던진다(0xb2e38) */
function rollRunOrThrow(g: RunnerPlayFrame, tick: number, target: BaseTarget, byHuman: ThrowChooser, cpuSpecial: boolean): boolean {
  const { holder, cover, coverSlot, base } = target
  const holderSlot = g.play.ballHolderSlot
  if (canReachBaseFirst(holder, cover, base)) {
    if (coverSlot !== holderSlot) stepOnBaseYourself(g, tick, holderSlot, base)
    return true
  }
  if (coverSlot === holderSlot || isTooCloseToThrow(holder, cover)) return false
  // b2d7e~b2dea: 거리(공가진야수, C) 0xbf9f0 > 600(b2dbe~b2dc8) · C ≠ +0x130(b2dd4) 관문(`isTooCloseToThrow`) 뒤
  //   +0x154 = C(b2dde) · vt5c(C, 특수) = 0xb2e38(b2de4~b2dea)
  const thrown = rollThrowBall(g, tick, coverSlot, base, byHuman, cpuSpecial)
  if (!thrown) return false
  returnThrowerToIdle(g, holderSlot)
  return true
}

/** b2d7e: 거리(공가진야수, C) ≤ 600 이면 던지지 않는다 */
function isTooCloseToThrow(holder: FielderState, cover: FielderState): boolean {
  return horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE
}

/** b2cb4: C = +0xf0[루 & 3] */
function coverSlotOf(g: RunnerPlayFrame, base: number): number {
  return g.play.coverOfBase[wrapBase(base)] ?? NONE
}

/**
 * 커버가 없으면 공 가진 야수가 직접 들고 뛴다 (b2cc4 — 상태 6 · vt48(루)). AI 6 은 분기표가 아무것도 안 해(b4c60) 6 절 걸음의
 * AI 0 시작 자리 고치기를 안 탄다 (r180 — 예전 웹은 AI 를 안 바꿔 AI 0 인 공 가진 야수가 시작 자리로 되돌아갔다).
 * vt48 0xa0a18 → vt14 — 관문(잠금 · vtc8)이 막으면 목표는 그대로(`acceptsTargetVt14`, r196)
 */
function carryBallToBase(g: RunnerPlayFrame, tick: number, holderSlot: number, base: number): void {
  const basePoint = basePosition(base)
  g.fielders = g.fielders.map((fielder) => {
    if (fielder.slot !== holderSlot) return fielder
    if (!acceptsTargetVt14(fielder)) return { ...fielder, aiState: AI_STATE.CARRY }
    return { ...fielder, target: basePoint, targetBase: base, aiState: AI_STATE.CARRY }
  })
  g.log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
}

/** b2d14~b2d64: t_run ≤ max(t_throw, t_recv) — 공 가진 야수가 송구 · 받기보다 먼저 루에 닿는다 */
function canReachBaseFirst(holder: FielderState, cover: FielderState, base: number): boolean {
  const runTicks = ticksToReach(holder.position, basePosition(base), holder.speed)
  return runTicks <= Math.max(throwTicksTo(holder, cover.target), fielderArrivalTicks(cover))
}

/**
 * 직접 밟으러 간다 (0xb2a48(P, +0x130, 루) — `claimCoverOfBase`, r180): 옛 커버 C 는 AI 0 만(목표 · 목표 루 그대로) ·
 * +0xf0[루] = 공 가진 야수 · vt48(루) · AI 루 + 2. 커버가 자기 자신이면(홈 도루의 포수) b2a6e 에서 아무것도 안 한다 —
 * 예전 웹은 커버를 안 바꾸고 공 가진 야수의 목표만 루로 적었다
 */
function stepOnBaseYourself(g: RunnerPlayFrame, tick: number, holderSlot: number, base: number): void {
  const claimed = claimCoverOfBase(g.play, g.fielders, holderSlot, base)
  g.play = claimed.play
  g.fielders = claimed.fielders
  g.log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
}

/**
 * 그다음 0xb2c90 b2df8~b2e14: 던진 야수가 커버(0xa0ff4 — AI 2~5)도 AI 9 도 아니면 0xb8dbc(…, 0) — 시작 자리 0xd86ec 로(b476a).
 * 미룬 송구(b30a2)는 던질 야수가 AI 9 라 그대로다
 */
function returnThrowerToIdle(g: RunnerPlayFrame, holderSlot: number): void {
  g.fielders = g.fielders.map((fielder) => {
    if (fielder.slot !== holderSlot) return fielder
    const keeps = (fielder.aiState >= AI_STATE.COVER_HOME && fielder.aiState <= AI_STATE.COVER_THIRD) || fielder.aiState === AI_STATE.RECEIVE
    return keeps ? fielder : { ...fielder, aiState: AI_STATE.IDLE }
  })
}
