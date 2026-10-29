import { type WorldPoint, basePosition } from '@/entities/fielding/model/fieldGeometry'
import { isReadyToThrow, withThrowMotion } from '@/entities/fielding/model/fielderPose'
import { type FielderState, NONE, fielderAbilityOf } from '@/entities/fielding/model/fieldingState'
import { LASER_THROW_SPEED, type ThrowPlan, planThrow, thrownWith } from '@/entities/fielding/model/throwPlan'
import type { CpuSpecialThrowChoice } from '@/features/defense-play/model/defensePlay/throw/cpuSpecialThrow'
import { chaseLooseBall } from '@/features/defense-play/model/looseBallChase'
import { THROW_ERROR_MARK_TICKS } from '@/features/defense-play/model/playerEffects'
import { cpuSpecialThrowOf } from '@/features/defense-play/model/runDefensePlay'
import { takeLooseBall } from '@/features/defense-play/model/runnerPlay/ball/takeLooseBall'
import { DEFAULT_ABILITY } from '@/features/defense-play/model/runnerPlay/constants'
import { coverTick } from '@/features/defense-play/model/runnerPlay/context/playContext'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { markSlot } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { deferThrow, isReceiverLate } from '@/features/defense-play/model/runnerPlay/throw/deferThrow'
import { throwLogOf } from '@/features/defense-play/model/runnerPlay/throw/throwLog'
import type { ThrowChooser } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'
import { type ThrownBall, forecastOptionsOf, launchThrow } from '@/features/defense-play/model/throwLaunch'

/**
 * **송구 0xb2e38**(플레이.vt5c, 인자 받을 야수 C · 특수) — 공 가진 야수가 C 에게 던진다. 던졌거나 미뤘으면(AI 9) 참.
 * 부르는 곳은 루로 보내기 0xb2c90(`rollSendToBase`)과 중계 이어 던지기 b4616 둘이다(`runDefensePlay` 의 rollThrowBall 과 같은 갈래).
 * b2e6c~b2ea0 이 송구 계획 0xb3444 를 +0x14c..+0x153 에 **미루기 검사(b2eb2) 앞에서** 적는다 — 미뤄도 계획은 새것이다.
 */
export function rollThrowBall(
  g: RunnerPlayFrame,
  tick: number,
  coverSlot: number,
  base: number,
  byHuman: ThrowChooser,
  cpuSpecial: boolean,
): boolean {
  const holderSlot = g.play.ballHolderSlot
  const holder = g.fielders[holderSlot]
  if (holder === undefined) return false
  // b2e44: vtC4(준비) — 던진 야수는 0xa1620 끝의 +0xb1 잠금으로 못 던진다(공을 안 쥔 야수는 못 던지는 것으로 본다,
  // `runDefensePlay` 의 rollThrowBall 과 같은 근사)
  if (!holder.holdingBall || !isReadyToThrow(holder)) return false
  // b2f06 — 레이저 발사 0x400bc 가 세운 플레이+0x1f4 를 본다. 레이저는 특수라 계획 0xb3444 가 중계를 안 끼운다(b3528)
  const plan = planThrow({ fielders: g.fielders, fromSlot: holderSlot, finalSlot: coverSlot, base, special: g.laserArmed || cpuSpecial })
  // b2e92~b2ea0: 계획을 +0x14c.. 에 덮어쓴다 — 중계면 [0] = 1 · [4] = 최종 받는 야수 · [7] = 목표 루 (b4616 이 본다)
  g.relayFinalSlot = plan.relayed ? coverSlot : NONE
  g.relayBase = plan.relayed ? base : NONE
  // b2eb2~b30d6: 받는 야수가 목표점에 없고 1구간 틱(계획 [5]) 안에 못 닿으면 미룬다 — AI 9 · vt48(루)
  if (isReceiverLate(g, plan)) return deferThrow(g, tick, holder, plan)
  rollThrowNow(g, tick, { coverSlot, base, byHuman, cpuSpecial }, plan)
  return true
}

interface ThrowOrder {
  readonly coverSlot: number
  readonly base: number
  readonly byHuman: ThrowChooser
  readonly cpuSpecial: boolean
}

/** 미루지 않은 송구 — 송구 0xb2e38 → 0xa1620 (악송구 굴림 0xa1828) · 받을 야수 예보 b307c · 손을 떠남 b2f80 · 커버 b3094 */
function rollThrowNow(g: RunnerPlayFrame, tick: number, order: ThrowOrder, plan: ThrowPlan): void {
  const holderSlot = g.play.ballHolderSlot
  const { coverSlot, base } = order
  const laser = armedLaserFor(g, plan, holderSlot)
  const special = !laser && order.cpuSpecial ? cpuSpecialThrowOf(g.fielders, holderSlot, coverSlot) : null
  const thrown = rollLaunchFromHand(g, holderSlot, { target: throwTargetOf(g, plan, base), laser, special })
  // b307c vt24(0) · vt34 — 받을(주울) 야수 · 포구 틱. 예보는 던진 야수가 손을 떠나기 전 칸으로 본다(b2f80 뒤지만 위치 · 목표는 같다)
  takeLooseBall(g, chaseLooseBall(thrown.ball, tick, g.fielders, forecastOptionsOf(thrown, holderSlot, coverSlot), g.maximumTicks))
  // b188a — 송구 예보가 두 번째 패스로 가면 그때의 +0x130(던진 야수 — b307c 앞)의 +0xc0 = 4
  if (g.chase?.secondPassStarted === true) g.throwErrorMarks = markSlot(g.throwErrorMarks, holderSlot, THROW_ERROR_MARK_TICKS)
  g.flight = { from: holderSlot, base, releaseTick: tick }
  if (g.firstThrowBase === NONE) recordFirstThrow(g, tick, base)
  releaseFromHand(g, holderSlot)
  // b3094 vt30 = 0xb1c90 한 번 — 고르기 vt34 가 공 가진 야수(+0x130)를 받을 야수로 바꾸고 AI 1 을 0 으로 내린 뒤라(b3b7a)
  // 커버를 그 상태로 다시 고른다. 던진 야수가 커버 표에 남으면 b2564 가 vt14(그 루) · AI 루 + 2 — 공을 쥐고 AI 1 이던 도루 판
  // 포수도 여기서 홈 커버로 돌아간다(`stealPlay` 머리말)
  coverTick(g, tick)
  g.log.push(throwLogOf(g, { tick, holderSlot, base, laser, cpuSpecial: order.cpuSpecial, plan, thrown, byHuman: order.byHuman }))
}

/** 공은 계획 [3](중계면 중계맨)의 목표점으로 간다(b2f52) */
function throwTargetOf(g: RunnerPlayFrame, plan: ThrowPlan, base: number): WorldPoint {
  return g.fielders[plan.toSlot]?.target ?? basePosition(base)
}

/** 판의 첫 송구 — 결과의 `throwBase` · `throwArrivalTick` (받는 틱은 송구 예보 뒤의 쫓는 공) */
function recordFirstThrow(g: RunnerPlayFrame, tick: number, base: number): void {
  g.firstThrowBase = base
  g.firstThrowArrival = g.chase?.catchTick ?? tick
}

/** b2ee6: 내야수 → 내야수 송구면 레이저 표시를 지운다 (vt64(0)). 남은 레이저로 던지면 판에 레이저 송구가 있었다고 적는다 */
function armedLaserFor(g: RunnerPlayFrame, plan: ThrowPlan, holderSlot: number): boolean {
  if (plan.toSlot <= 5 && holderSlot <= 5) {
    g.laserArmed = false
    return false
  }
  if (g.laserArmed) g.laserThrow = true
  return g.laserArmed
}

interface HandLaunch {
  readonly target: WorldPoint
  readonly laser: boolean
  readonly special: CpuSpecialThrowChoice | null
}

/**
 * a16dc~a16ec: +0xdc = 특수 ? +0xd8 : +0xd4 — 던질 때 덮어쓰고 그 판 동안 남는다. 레이저(0xa222c a229c)는 +0xdc = 2000 고정.
 * b2f06 — 레이저로 던진 뒤 vt64(0). 0xa1620 — 원바운드(a17fc) · 악송구(a1828) · 긴 송구 흔들림(a198c) 갈래와 세계 0xbfed0 · 받는 점
 * 끼워 넣기(b2f9c). 레이저 0xa222c 는 난수 굴림이 없다(악송구 · 흔들림 없음). 공은 계획 [3](중계면 중계맨)의 목표점으로 간다(b2f52).
 * a1908(악송구) · a17fc(원바운드) — 던진 야수 +0xc0 = 4 (그림 0x438c4 의 "!")
 */
function rollLaunchFromHand(g: RunnerPlayFrame, holderSlot: number, launch: HandLaunch): ThrownBall {
  const isSpecial = launch.special !== null && launch.special.special
  g.fielders = g.fielders.map((fielder) => (fielder.slot === holderSlot ? throwSpeedSetOf(fielder, launch.laser, isSpecial) : fielder))
  if (launch.laser) g.laserArmed = false
  const thrown = launchThrow({
    thrower: g.fielders[holderSlot],
    target: launch.target,
    special: isSpecial,
    bounce: isSpecial && launch.special.bounce,
    laser: launch.laser,
    ability: fielderAbilityOf(g.abilities, holderSlot, DEFAULT_ABILITY),
    random: g.input.random,
    body: g.ballBody,
  })
  if (thrown.errant) g.errantThrow = true
  if (thrown.errant || thrown.bounce) g.throwErrorMarks = markSlot(g.throwErrorMarks, holderSlot, THROW_ERROR_MARK_TICKS)
  return thrown
}

function throwSpeedSetOf(fielder: FielderState, laser: boolean, special: boolean): FielderState {
  return laser ? { ...fielder, throwSpeed: LASER_THROW_SPEED } : thrownWith(fielder, special)
}

/**
 * 던지면 손을 떠난다(b2f80 · b3070) — 준비 틱(+0xc8)도 썼다. 던지기 0xa1620 끝 a1a26~a1a3a 가 동작 5 · +0xb1 = 1(r176) —
 * 다음 야수 틱이 걸음 없이(vtc8 거짓) a143e 에서 지우고 vt10(목표 = 위치)
 */
function releaseFromHand(g: RunnerPlayFrame, holderSlot: number): void {
  g.fielders = g.fielders.map((fielder) =>
    fielder.slot === holderSlot ? withThrowMotion({ ...fielder, holdingBall: false, actionRemainingTicks: 0 }) : fielder,
  )
}
