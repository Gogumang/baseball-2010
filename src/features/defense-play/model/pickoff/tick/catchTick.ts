import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import { type WorldPoint, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { withCatchMotion, withFlyWaitPose } from '@/entities/fielding/model/fielderPose'
import { rollFumble } from '@/entities/fielding/model/fieldingErrors'
import { type FielderState, NONE, recordPlayerAbilityOf } from '@/entities/fielding/model/fieldingState'
import { baseUnderFoot } from '@/entities/fielding/model/outJudgement'
import { readyTicksOf } from '@/entities/fielding/model/throwPlan'
import { isBallStoppedAt } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import type { LooseBallChase } from '@/features/defense-play/model/looseBallChase'
import { DEFAULT_ABILITY } from '@/features/defense-play/model/pickoff/constants'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { runOutJudgement } from '@/features/defense-play/model/pickoff/judgement/outJudgement'
import { isAtTarget, markSlot, wrapBase } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'
import { PICKOFF_RESULT } from '@/features/defense-play/model/pickoff/types/pickoffTypes'
import { FUMBLE_MARK_TICKS } from '@/features/defense-play/model/playerEffects'

/**
 * **5. 포구 틱 갈래 0xb401c** — 받는(줍는) 야수가 포구 틱(+0x174)에
 * ```
 * b4224  r4 = 펌블표[등급] > rand(0, 10000)       ; 늘 먹는다
 * b4236  멈춤 = 공.vt18() ; r4 && !멈춤 → 메시지 0xbc2 · 사건 sp+0x24 = 1 (쥐지 않음)
 * b4292  아니면 b = 야수.vt58()(발밑 루) ; b ≠ −1 && 0xa97a0(b).vt18() → 결과 코드 9
 * b42c8  쥐기 0xb2710(P, f, 1) — +0x128 · 준비 틱(내야 3) · vt90
 * ```
 * 그 앞 5254c — +0x1991(레이저 잔상) && 포구 관문(아무도 안 쥠) && 동작 시작 틱 − 1 == 공 틱이면 +0x1991 = 0
 */
export function rollPickoffCatch(g: PickoffFrame, tick: number): void {
  if (g.laserTrailOn && !g.play.held && tick === g.play.actionStartTick - 1) g.laserTrailOn = false
  const chase = g.chase
  if (chase === null || g.play.held) return
  setCatchPoses(g, tick, chase)
  if (tick !== chase.catchTick) return
  const fumbled = rollChaseFumble(g, tick, chase)
  if (!fumbled) grabChasedBall(g, tick, chase.slot)
}

/**
 * b40ca~b419c (포구 틱 갈래 앞, 매 틱 — 관문 b4062 vt50: 아무도 안 쥠). 받는 견제 · 송구도 타구와 같은 갈래다(r176):
 * vt9c(뜬공 기다리기 — 잡을 야수가 서 있고 목표 x · z == 포구 틱 공 점 · +0x174 < 공+0xaa0 · 종류 0) · 동작 시작 틱(+0x176)이면
 * 표 0xd87f4[+0x16c] 포구 동작(`fielderPose.withCatchMotion`). 종류 · 시작 틱은 송구 b307c 의 고르기 0xb3b38 이 적는다
 */
function setCatchPoses(g: PickoffFrame, tick: number, chase: LooseBallChase): void {
  const catcher = g.fielders[g.play.catchFielderSlot]
  const ballAtCatch = chase.trajectory.pointAt(chase.catchTick)
  if (catcher !== undefined && isWaitingUnderFly(g, chase, catcher, ballAtCatch)) {
    g.fielders = g.fielders.map((fielder) => (fielder.slot === catcher.slot ? withFlyWaitPose(fielder) : fielder))
  }
  if (tick === g.play.actionStartTick) {
    g.fielders = g.fielders.map((fielder) => (fielder.slot === g.play.catchFielderSlot ? withCatchMotion(fielder, g.play.catchKind) : fielder))
  }
}

function isWaitingUnderFly(g: PickoffFrame, chase: LooseBallChase, catcher: FielderState, ballAtCatch: WorldPoint): boolean {
  const beforeLanding = g.play.catchKind === CATCH_KIND.LOW && chase.catchTick < chase.trajectory.landingTick
  const underBall = catcher.target.x === ballAtCatch.x && catcher.target.z === ballAtCatch.z
  return beforeLanding && isSamePoint(catcher.position, catcher.target) && underBall
}

/** b4224 · b4236 — 펌블 굴림(난수가 없으면 굴리지 않고 잡는다). 움직이는 공이면 펌블 — 야수 +0xb8 = 6(b4280) · 사건 sp+0x24 */
function rollChaseFumble(g: PickoffFrame, tick: number, chase: LooseBallChase): boolean {
  const random = g.input.random
  if (random === undefined) return false
  const ballIsMoving = !isBallStoppedAt(chase.trajectory, tick)
  const fumbled = rollFumble(recordPlayerAbilityOf(g.abilities, chase.slot, DEFAULT_ABILITY), ballIsMoving, random)
  if (!fumbled) return false
  g.fumbled = true
  g.ballEventThisTick = true
  g.fumbleMarks = markSlot(g.fumbleMarks, chase.slot, FUMBLE_MARK_TICKS)
  g.log.push(`${tick}틱 ${chase.slot}번 야수 펌블 (0xbc2)`)
  return true
}

/**
 * b4292 · b42c8 — 쥐기. 쥔 동안 공+0x68 이 멈춘다(0x3f378 3f3aa) — 커버 다시 고르기의 공 각이 이 점을 본다(`runnerPlayBallInput`).
 * 쥐기 0xb2710 은 위치 · 목표를 안 바꾼다(r176 — 예전 웹은 포구 지점으로 옮겨 쥐었다). 발밑 루(vt58)도 목록 틱이 옮긴 자리다.
 * 쥐기 0xb2710 의 메시지 0x15 → 경기+0x19ac = 1. 발밑 루에 산 주자가 서 있는 포구는 결과 코드 9 (판 결과 칸은 첫 번째만 적지만
 * 메시지는 포구마다 간다) — 주자가 서 있나는 쥐기의 판정(vt90) **뒤**의 주자 칸으로 본다(원본 그대로의 차례)
 */
function grabChasedBall(g: PickoffFrame, tick: number, receiver: number): void {
  g.chase = null
  const heldPath = g.ballPath
  if (heldPath !== null) g.ballPath = { ...heldPath, heldAt: tick }
  g.flight = null
  if (g.catchTick < 0) g.catchTick = tick
  g.fielders = g.fielders.map((fielder) => fielderAfterGrab(fielder, receiver))
  const footBase = baseUnderFoot(g.fielders[receiver])
  const onBase = footBase === NONE ? undefined : g.runners.find((runner) => !runner.state.isOut && wrapBase(runner.state.startBase) === footBase)
  g.play = { ...g.play, ballHolderSlot: receiver, catchFielderSlot: receiver, held: true, wantsThrow: true }
  g.grabbed = true
  g.log.push(`${tick}틱 ${receiver}번 야수가 공을 쥐었다`)
  runOutJudgement(g, tick)
  if (onBase === undefined || !isAtTarget(onBase.state)) return
  g.tickMessageCode = 9
  if (g.resultCode !== null) return
  g.resultCode = PICKOFF_RESULT.SAFE
  g.log.push(`${tick}틱 ${footBase}루 세이프 (결과 9)`)
}

function fielderAfterGrab(fielder: FielderState, receiver: number): FielderState {
  if (fielder.slot === receiver) return { ...fielder, holdingBall: true, actionRemainingTicks: readyTicksOf(receiver) }
  return fielder.holdingBall ? { ...fielder, holdingBall: false } : fielder
}
