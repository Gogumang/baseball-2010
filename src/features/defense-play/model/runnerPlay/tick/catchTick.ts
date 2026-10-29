import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import { type WorldPoint, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { withCatchMotion, withFlyWaitPose } from '@/entities/fielding/model/fielderPose'
import { rollFumble } from '@/entities/fielding/model/fieldingErrors'
import { type FielderState, NONE, recordPlayerAbilityOf } from '@/entities/fielding/model/fieldingState'
import { baseUnderFoot } from '@/entities/fielding/model/outJudgement'
import { readyTicksOf } from '@/entities/fielding/model/throwPlan'
import { isBallStoppedAt } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import type { LooseBallChase as ChasedBall } from '@/features/defense-play/model/looseBallChase'
import { FUMBLE_MARK_TICKS } from '@/features/defense-play/model/playerEffects'
import { DEFAULT_ABILITY } from '@/features/defense-play/model/runnerPlay/constants'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { grab } from '@/features/defense-play/model/runnerPlay/judgement/outJudgement'
import { isAtTarget, markSlot, wrapBase } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { RUNNER_PLAY_RESULT } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

/**
 * **1. 포구 틱 갈래 0xb401c** — 쫓는 공을 고른 야수가 포구 틱(+0x174)에
 * ```
 * b4224  r4 = 펌블표[등급] > rand(0, 10000)       ; 늘 먹는다
 * b4236  멈춤 = 공.vt18() ; r4 && !멈춤 → 야수+0xb8 = 6 · 메시지 0xbc2 · 사건 sp+0x24 = 1 (쥐지 않음)
 * b4292  아니면 b = 야수.vt58()(발밑 루) ; b ≠ −1 && 0xa97a0(b)(그 루에 마지막으로 닿은 산 주자).vt18() → 결과 코드 9
 * b42c8  쥐기 0xb2710(P, f, 1) — +0x128 · +0x130 · +0x12c · +0x112 · 준비 틱(내야 3 · 외야 6) · vt90
 * ```
 * 그 앞 5254c — +0x1991(레이저 잔상) && 포구 관문(아무도 안 쥠) && 동작 시작 틱 − 1 == 공 틱이면 +0x1991 = 0
 */
export function rollRunnerPlayCatch(g: RunnerPlayFrame, tick: number): void {
  if (g.laserTrailOn && !g.play.held && tick === g.play.actionStartTick - 1) g.laserTrailOn = false
  const chase = g.chase
  if (chase === null || g.play.held) return
  setCatchPoses(g, tick, chase)
  if (tick !== chase.catchTick) return
  const fumbled = rollChaseFumble(g, tick, chase)
  if (!fumbled) grabChasedBall(g, tick, chase)
}

/**
 * b40ca~b419c (포구 틱 갈래 앞, 매 틱 — 관문 b4062 vt50: +0x12c(쥠) 등이 0 일 때). 받는 송구 · 줍는 공도 타구와 같은 갈래다(r176):
 * 잡을 야수(+0x170)가 서 있고 목표점 x · z 가 포구 틱 공 점과 같고 +0x174 < 공+0xaa0 && 종류 0 이면 vt9c(뜬공 기다리기),
 * 공 틱이 동작 시작 틱(+0x176)이면 표 0xd87f4[+0x16c] 로 포구 동작 · 자세 워드(`fielderPose.withCatchMotion`). 종류 · 시작 틱은
 * 고르기 0xb3b38 이 송구 0xb2e38 의 b307c · 다시 쏘기 b32a4 · 판 시작 b2878 에서 적는다(`takeLooseBall` · 판 시작 칸)
 */
function setCatchPoses(g: RunnerPlayFrame, tick: number, chase: ChasedBall): void {
  const catcher = g.fielders[g.play.catchFielderSlot]
  const ballAtCatch = chase.trajectory.pointAt(chase.catchTick)
  if (catcher !== undefined && isWaitingUnderFly(g, chase, catcher, ballAtCatch)) {
    g.fielders = g.fielders.map((fielder) => (fielder.slot === catcher.slot ? withFlyWaitPose(fielder) : fielder))
  }
  if (tick === g.play.actionStartTick) {
    g.fielders = g.fielders.map((fielder) => (fielder.slot === g.play.catchFielderSlot ? withCatchMotion(fielder, g.play.catchKind) : fielder))
  }
}

function isWaitingUnderFly(g: RunnerPlayFrame, chase: ChasedBall, catcher: FielderState, ballAtCatch: WorldPoint): boolean {
  const beforeLanding = g.play.catchKind === CATCH_KIND.LOW && chase.catchTick < chase.trajectory.landingTick
  const underBall = catcher.target.x === ballAtCatch.x && catcher.target.z === ballAtCatch.z
  return beforeLanding && isSamePoint(catcher.position, catcher.target) && underBall
}

/** b4224 · b4236 — 펌블 굴림(난수가 없으면 굴리지 않고 잡는다). 움직이는 공이면 펌블 — 야수 +0xb8 = 6(b4280) · 사건 sp+0x24 */
function rollChaseFumble(g: RunnerPlayFrame, tick: number, chase: ChasedBall): boolean {
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
 * b4292 · b42c8 — 쥐기. 쥐기 0xb2710 은 위치 · 목표를 안 바꾼다(r176 — 예전 웹은 포구 지점으로 옮겨 쥐었다). 야수 자리는 그림 N 의
 * 목록 틱(앞 판 틱 6 절 이동)이 옮긴 그대로라 발밑 루(vt58)도 그 자리로 본다.
 * 발밑 루에 산 주자가 서 있는 포구는 결과 코드 9 (판 결과 칸은 첫 번째만 적지만 메시지는 포구마다 간다) — 주자가 서 있나는 쥐기의
 * 판정(vt90) **뒤**의 주자 칸으로 본다(원본 그대로의 차례)
 */
function grabChasedBall(g: RunnerPlayFrame, tick: number, chase: ChasedBall): void {
  g.chase = null
  g.flight = null
  g.diveBall = { ...g.diveBall, heldAt: tick }
  if (g.ballPath !== null) g.ballPath = { ...g.ballPath, heldAt: tick }
  if (g.firstCatchTick < 0) g.firstCatchTick = tick
  const footBase = baseUnderFoot(g.fielders[chase.slot])
  const onBase = footBase === NONE ? undefined : g.runners.find((runner) => !runner.state.isOut && wrapBase(runner.state.startBase) === footBase)
  grab(g, tick, chase.slot, { actionRemainingTicks: readyTicksOf(chase.slot) })
  g.log.push(`${tick}틱 ${chase.slot}번 야수가 공을 쥐었다`)
  if (onBase === undefined || !isAtTarget(onBase.state)) return
  g.tickMessageCode = 9
  if (g.resultCode !== null) return
  g.resultCode = RUNNER_PLAY_RESULT.SAFE
  g.log.push(`${tick}틱 ${footBase}루 세이프 (결과 9)`)
}
