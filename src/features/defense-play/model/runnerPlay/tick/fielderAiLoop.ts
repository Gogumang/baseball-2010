import { backupPointOf } from '@/entities/fielding/model/catchPrediction'
import { claimCoverOfBase, needsCover, withCoverBaseTarget } from '@/entities/fielding/model/coverAssignment'
import { FIELDER_START_POSITIONS, type WorldPoint, basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { isFreeToRetarget, isFreeToStep } from '@/entities/fielding/model/fielderPose'
import { AI_STATE, type FielderState, NONE, fielderArrivalTicks } from '@/entities/fielding/model/fieldingState'
import { throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { DIVE_TICK_NONE } from '@/features/defense-play/model/catchForecast'
import { type DiveCheck, diveCheckOf, logDiveCheck } from '@/features/defense-play/model/diveCheck'
import { contextAt } from '@/features/defense-play/model/runnerPlay/context/playContext'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { rollSendToBase } from '@/features/defense-play/model/runnerPlay/throw/sendToBase'

/**
 * **3c. 야수 AI 고리** (같은 vt4c, 분기표 0xd8808) — AI 9 미룬 송구 (b4838): 받을 야수.vtc0() ≤ 공 가진 야수.vtb8(루 좌표) 가 되면
 * 0xb2c90(루, 0), 참이면 AI 0. AI 2~5(b47f2, 같은 고리 — 칸 차례로 AI 9 와 섞어 돈다, r176): +0x3b && vtcc 면 0xb2a48(P, 칸, 루)
 * (`claimCoverOfBase`). 칸 차례가 곧 송구 굴림 차례라 고리는 칸 0 부터 그대로 돈다
 */
export function rollRunnerPlayFielderAi(g: RunnerPlayFrame, tick: number): void {
  for (let slot = 0; slot < g.fielders.length; slot += 1) rollFielderAiSlot(g, tick, slot)
}

/** 칸 하나 — 다이빙 검사 뒤 분기. 분기는 옛 상태로 한다(b475c 의 r5) — AI 0xd 가 된 칸은 분기 없이 다음 칸(b4c5c) */
function rollFielderAiSlot(g: RunnerPlayFrame, tick: number, slot: number): void {
  const dive = applyDiveCheck(g, tick, slot)
  if (dive !== null && dive.skipDispatch) return
  const self = g.fielders[slot]
  if (self === undefined) return
  const dispatchState = dive === null ? self.aiState : dive.dispatchState
  if (dispatchState >= AI_STATE.COVER_HOME && dispatchState <= AI_STATE.COVER_THIRD) {
    coverAi(g, tick, slot, self, dispatchState - AI_STATE.COVER_HOME)
    return
  }
  STEERING_AI[dispatchState]?.(g, slot, self)
  rollDeferredThrow(g, tick, slot, self)
}

type SteeringAi = (g: RunnerPlayFrame, slot: number, self: FielderState) => void

/** 목표만 고치고 AI 9 미룬 송구 검사로 이어지는 갈래 — AI 0 · 1 · 0xc */
const STEERING_AI: Readonly<Partial<Record<number, SteeringAi>>> = {
  [AI_STATE.IDLE]: idleAi,
  [AI_STATE.CHASE]: chaseAi,
  [AI_STATE.BACKUP]: backupAi,
}

/** b46c2~b475a 다이빙 검사 — 분기 앞에서 칸마다 (`diveCheckOf`, r180). 공+0x68 — 쥔 동안은 쥔 틱에 머문다(0x3f378 3f3aa) */
function applyDiveCheck(g: RunnerPlayFrame, tick: number, slot: number): DiveCheck | null {
  const diveTrajectory = g.diveBall.trajectory
  if (diveTrajectory === null) return null
  const heldAt = g.play.held && g.diveBall.heldAt >= 0 ? g.diveBall.heldAt : tick
  const dive = diveCheckOf({
    fielder: g.fielders[slot],
    diveTick: g.diveBall.ticks[slot] ?? DIVE_TICK_NONE,
    catchTick: g.diveBall.catchTick,
    ballTick: heldAt - g.diveBall.launchTick,
    coverNeeded: (base) => needsCover(contextAt(g, tick), base),
    ballPointAt: (at) => diveTrajectory.pointAt(g.diveBall.launchTick + at),
  })
  if (dive === null) return null
  const before = g.fielders[slot]
  g.fielders = g.fielders.map((fielder) => (fielder.slot === slot ? dive.fielder : fielder))
  logDiveCheck(g.log, tick, slot, before, dive)
  return dive
}

/** 한 칸의 목표만 갈아 끼운다 */
function retargetSlot(g: RunnerPlayFrame, slot: number, target: WorldPoint): void {
  g.fielders = g.fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target } : fielder))
}

/**
 * AI 0 b476a — vtcc 면 목표가 시작 자리 0xd86ec[칸] 와 다를 때 vt50(= vt14)로 그 자리로. 고리 안이라 같은 틱 끝 b4c72 의
 * 커버 다시 고르기(0xb1c90)가 고친 목표를 본다 — 고리 뒤에 AI 0 이 된 야수는 다음 고리에서 돌아선다 (r180, `runDefensePlay` 1c 절)
 */
function idleAi(g: RunnerPlayFrame, slot: number, self: FielderState): void {
  if (!isFreeToRetarget(self)) return
  const home = FIELDER_START_POSITIONS[slot]
  if (home !== undefined && !isSamePoint(self.target, home)) retargetSlot(g, slot, home)
}

/**
 * AI 1 b4aca~b4b5a — vtcc 이고 쥐지 않았으면(+0xe0, b4ae6) 포구 지점(x, 0, z)으로 0xa100c(= vt14). 고리 안이라 같은 틱 끝
 * b4c72 의 커버 다시 고르기가 고친 목표를 본다 (r190 — 예전 웹은 6 절 걸음에서 골랐다). 쥐면 `chase` 가 비어 안 고친다.
 * b4af6 — 움직임 허용 +0x13c[칸](마지막 예보가 적은 값, `LooseBallChase.movable`)이 0 이면 안 고친다: 보통 송구(a = 0 ·
 * 공+0xaac == 0)를 받는 야수는 두 번째 패스가 아니면 고르기 0xb3b38 이 준 목표 그대로다(r196)
 */
function chaseAi(g: RunnerPlayFrame, slot: number, self: FielderState): void {
  const chased = g.chase
  if (chased === null || chased.slot !== slot || chased.movable === false) return
  if (isFreeToRetarget(self) && !isSamePoint(self.target, chased.catchPoint)) retargetSlot(g, slot, chased.catchPoint)
}

/** AI 0xc b4b78 — 공 가진 야수(+0x130)의 목표 T 에서 2000 뒤(`backupPointOf`)로 vt14(잠금 +0xb4 ≤ 0 · vtc8 일 때만, r180) */
function backupAi(g: RunnerPlayFrame, slot: number, self: FielderState): void {
  const backup = backupPointOf(g.fielders[g.play.ballHolderSlot]?.target ?? self.target, self.position)
  if (backup !== null && self.actionLockTicks <= 0 && isFreeToStep(self)) retargetSlot(g, slot, backup)
}

/** AI 2~5 b47f2 — 막 닿았고 vtcc 면 0xb2a48. b4818~b482e — 조건 없이 vt14(0xd86b0[루]) — 관문(잠금 +0xb4 · vtc8)이 막으면 목표는 그대로(r201) */
function coverAi(g: RunnerPlayFrame, tick: number, slot: number, self: FielderState, base: number): void {
  if (g.fielderArrivals[slot] === true && isFreeToRetarget(self)) {
    const claimed = claimCoverOfBase(g.play, g.fielders, slot, base)
    if (claimed.play !== g.play) g.log.push(`${tick}틱 ${slot}번 야수가 ${base}루 커버를 가져간다 (b4814 0xb2a48)`)
    g.play = claimed.play
    g.fielders = claimed.fielders
  }
  g.fielders = withCoverBaseTarget(g.fielders, slot, base)
}

/** AI 9 b4838 — 미룬 송구: 받을 야수가 송구보다 먼저 닿으면 그 루로 보내고(0xb2c90) 참이면 AI 0 */
function rollDeferredThrow(g: RunnerPlayFrame, tick: number, slot: number, self: FielderState): void {
  if (g.deferredThrowReceiver === NONE || self.aiState !== AI_STATE.RECEIVE) return
  const receiver = g.fielders[g.deferredThrowReceiver]
  const holder = g.fielders[g.play.ballHolderSlot]
  if (receiver === undefined || holder === undefined) return
  if (fielderArrivalTicks(receiver) > throwTicksTo(holder, basePosition(g.deferredThrowBase))) return
  const sent = rollSendToBase(g, tick, g.deferredThrowBase, '미룬', false)
  if (sent) g.fielders = g.fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, aiState: AI_STATE.IDLE } : fielder))
}
