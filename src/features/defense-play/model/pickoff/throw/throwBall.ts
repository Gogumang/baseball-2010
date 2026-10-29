import { type WorldPoint, basePosition } from '@/entities/fielding/model/fieldGeometry'
import { isReadyToThrow, withThrowMotion } from '@/entities/fielding/model/fielderPose'
import { type FielderState, NONE, fielderAbilityOf } from '@/entities/fielding/model/fieldingState'
import { LASER_THROW_SPEED, type ThrowPlan, planThrow, thrownWith } from '@/entities/fielding/model/throwPlan'
import type { CpuSpecialThrowChoice } from '@/features/defense-play/model/defensePlay/throw/cpuSpecialThrow'
import { chaseLooseBall } from '@/features/defense-play/model/looseBallChase'
import { takeLooseBall } from '@/features/defense-play/model/pickoff/ball/takeLooseBall'
import { DEFAULT_ABILITY, MAXIMUM_TICKS } from '@/features/defense-play/model/pickoff/constants'
import { coverTick } from '@/features/defense-play/model/pickoff/context/pickoffContext'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { markSlot } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'
import { deferThrow, isReceiverLate } from '@/features/defense-play/model/pickoff/throw/deferThrow'
import { throwLogOf } from '@/features/defense-play/model/pickoff/throw/throwLog'
import { THROW_ERROR_MARK_TICKS } from '@/features/defense-play/model/playerEffects'
import { cpuSpecialThrowOf } from '@/features/defense-play/model/runDefensePlay'
import { type ThrownBall, forecastOptionsOf, launchThrow } from '@/features/defense-play/model/throwLaunch'

/**
 * **송구 0xb2e38**(플레이.vt5c, 인자 받을 야수 C · 특수) — 던졌거나 미뤘으면(AI 9) 참. 부르는 곳은 루로 보내기 0xb2c90 과
 * 중계 이어 던지기 b4616 둘(`runnerPlayEngine` 의 rollThrowBall 과 같다). 계획 0xb3444 는 미루기 검사(b2eb2) 앞에서 +0x14c 에 적는다.
 */
export function rollThrowBall(g: PickoffFrame, tick: number, coverSlot: number, base: number, chooser: string, cpuSpecial: boolean): boolean {
  const holderSlot = g.play.ballHolderSlot
  const holder = g.fielders[holderSlot]
  if (holder === undefined) return false
  // ── 0xb2e38 ──
  if (!holder.holdingBall || !isReadyToThrow(holder)) return false
  // b2f06 — 레이저 발사 0x400bc 가 세운 플레이+0x1f4 를 본다. 레이저는 특수라 계획 0xb3444 가 중계를 안 끼운다(b3528)
  const plan = planThrow({ fielders: g.fielders, fromSlot: holderSlot, finalSlot: coverSlot, base, special: g.laserArmed || cpuSpecial })
  // b2e92~b2ea0: 계획을 +0x14c.. 에 덮어쓴다 — 중계면 [0] = 1 · [4] = 최종 받는 야수 · [7] = 목표 루 (b4616 이 본다)
  g.relayFinalSlot = plan.relayed ? coverSlot : NONE
  g.relayBase = plan.relayed ? base : NONE
  if (isReceiverLate(g, plan)) return deferThrow(g, tick, holder, plan)
  rollThrowNow(g, tick, { coverSlot, base, chooser, cpuSpecial }, plan)
  return true
}

interface ThrowOrder {
  readonly coverSlot: number
  readonly base: number
  readonly chooser: string
  readonly cpuSpecial: boolean
}

/** 미루지 않은 송구 — 0xa1620 · 세계 · 받는 점 끼워 넣기 · 예보 b307c · 손을 떠남 b2f80 · 커버 b3094 */
function rollThrowNow(g: PickoffFrame, tick: number, order: ThrowOrder, plan: ThrowPlan): void {
  const holderSlot = g.play.ballHolderSlot
  const { coverSlot, base } = order
  const laser = armedLaserFor(g, plan, holderSlot)
  const special = !laser && order.cpuSpecial ? cpuSpecialThrowOf(g.fielders, holderSlot, coverSlot) : null
  const thrown = rollLaunchFromHand(g, holderSlot, { target: throwTargetOf(g, plan, base), laser, special })
  // b307c vt24(0) · vt34 — 받을(주울) 야수 · 포구 틱
  takeLooseBall(g, chaseLooseBall(thrown.ball, tick, g.fielders, forecastOptionsOf(thrown, holderSlot, coverSlot), MAXIMUM_TICKS))
  // b188a — 송구 예보가 두 번째 패스로 가면 그때의 +0x130(던진 야수 — b307c 앞)의 +0xc0 = 4
  if (g.chase?.secondPassStarted === true) g.throwErrorMarks = markSlot(g.throwErrorMarks, holderSlot, THROW_ERROR_MARK_TICKS)
  g.flight = { from: holderSlot, base, releaseTick: tick }
  // b2f80 · b3070 손을 떠난다. 던지기 0xa1620 끝 a1a26~a1a3a — 동작 5 · +0xb1 = 1 (r176, 다음 야수 틱이 걸음 없이 지우고 vt10)
  g.fielders = g.fielders.map((fielder) =>
    fielder.slot === holderSlot ? withThrowMotion({ ...fielder, holdingBall: false, actionRemainingTicks: 0 }) : fielder,
  )
  // b3094 vt30 = 0xb1c90 한 번 — 고르기 vt34 뒤의 공 가진 야수(받을 야수)로 커버를 다시 고른다(`coverTick.runCoverTick`)
  coverTick(g, tick)
  g.log.push(throwLogOf(g, { tick, holderSlot, base, laser, cpuSpecial: order.cpuSpecial, plan, thrown, chooser: order.chooser }))
}

/** 공은 계획 [3](중계면 중계맨)의 목표점으로 (b2f52) */
function throwTargetOf(g: PickoffFrame, plan: ThrowPlan, base: number): WorldPoint {
  return g.fielders[plan.toSlot]?.target ?? basePosition(base)
}

/** b2ee6: 내야수 → 내야수 송구면 레이저 표시를 지운다 (vt64(0)). 남은 레이저로 던지면 판에 레이저 송구가 있었다고 적는다 */
function armedLaserFor(g: PickoffFrame, plan: ThrowPlan, holderSlot: number): boolean {
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
 * a16dc~a16ec: +0xdc = 특수 ? +0xd8 : +0xd4. 레이저(0xa222c a229c)는 +0xdc = 2000 고정. b2f06 — 레이저로 던진 뒤 vt64(0).
 * 0xa1620 — 레이저 0xa222c 는 난수 굴림이 없다. a1908(악송구) · a17fc(원바운드) — 던진 야수 +0xc0 = 4 (그림 0x438c4 의 "!")
 */
function rollLaunchFromHand(g: PickoffFrame, holderSlot: number, launch: HandLaunch): ThrownBall {
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
