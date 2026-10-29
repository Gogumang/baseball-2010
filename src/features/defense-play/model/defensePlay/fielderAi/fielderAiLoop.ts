import { needsCover } from '@/entities/fielding/model/coverAssignment'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState, NONE, fielderArrivalTicks } from '@/entities/fielding/model/fieldingState'
import { throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { DIVE_TICK_NONE } from '@/features/defense-play/model/catchForecast'
import {
  type FielderAiStep,
  backupAi,
  chaseAi,
  coverAi,
  idleAi,
  pickUpAi,
  returnAi,
} from '@/features/defense-play/model/defensePlay/fielderAi/steeringAi'
import { isCoverState } from '@/features/defense-play/model/defensePlay/fielders/moveFielder'
import { rollRundownAi } from '@/features/defense-play/model/defensePlay/rundown/rundownAi'
import { contextAt } from '@/features/defense-play/model/defensePlay/step/defenseContext'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import { rollSendToBase } from '@/features/defense-play/model/defensePlay/throw/sendToBase'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { type DiveCheck, diveCheckOf, logDiveCheck } from '@/features/defense-play/model/diveCheck'

/**
 * **1c. 야수 AI 고리** (vt4c 의 칸 고리 — 분기표 0xd8808). AI 9 — 0xb2e38 이 미룬 송구 (0xd8808[9] = b4838, 직접 뜬 것)
 * ```
 * b4838: R = 야수[+0x15c] ; t1 = R.vtc0() ; H = 공 가진 야수 ; t2 = H.vtb8(0xd86b0[+0x158])
 * b488c: t1 > t2 → 이번 틱은 기다린다
 * b4892: 아니면 플레이.vt58(+0x158, 0) = 0xb2c90 ; 참이면 b48ac 이 야수 AI 0
 * ```
 * 미룰 때 공 가진 야수는 vt48(루)로 그 루를 향해 걷는다(`moveFielder`). 특수 인자는 0 으로 다시 보낸다.
 * AI 2~5 (같은 고리의 분기표 0xd8808[2..5] = b47f2, 직접 뜬 것, r176): +0x3b(앞 목록 틱에 목표점에 막 닿음) && vtcc 면
 * b4814 0xb2a48(P, 칸, 루) — 그 루의 커버 칸(+0xf0)이 다른 야수면 그 야수를 AI 0 으로 내리고 이 야수가 커버가 된다
 * (`claimCoverOfBase`). 그 뒤 b4818~b482e vt14(루 좌표)는 6 절 걸음이 한다. 고리는 칸 차례라 AI 9 와 섞어 돈다
 */
export function rollFielderAiLoop(s: DefensePlayState, t: TickFrame): void {
  for (let slot = 0; slot < s.fielders.length; slot += 1) rollFielderAiSlot(s, t, slot)
}

/** 칸 하나 — 다이빙 검사 뒤 분기표 갈래. 분기는 옛 상태로 한다(b475c 의 r5) */
function rollFielderAiSlot(s: DefensePlayState, t: TickFrame, slot: number): void {
  const dive = applyDiveCheck(s, t, slot)
  // AI 0xd 가 된 칸은 분기 없이 다음 칸(b4c5c)
  if (dive !== null && dive.skipDispatch) return
  const self = s.fielders[slot]
  if (self === undefined) return
  const dispatchState = dive === null ? self.aiState : dive.dispatchState
  if (isCoverState(dispatchState)) {
    coverAi(s, t, slot, self, dispatchState - AI_STATE.COVER_HOME)
    return
  }
  const terminal = TERMINAL_AI[dispatchState]
  if (terminal !== undefined) {
    terminal(s, t, slot, self)
    return
  }
  STEERING_AI[dispatchState]?.(s, t, slot, self)
  rollDeferredThrow(s, t, slot, self)
}

/** 분기 뒤 다음 칸으로 가는 갈래 — AI 0xb 담장 앞 줍기 · AI 8 협살 */
const TERMINAL_AI: Readonly<Partial<Record<number, FielderAiStep>>> = {
  [AI_STATE.PICK_UP]: (s, _t, slot, self) => pickUpAi(s, slot, self),
  [AI_STATE.RUNDOWN]: (s, t, slot) => rollRundownAi(s, t, slot),
}

/** 목표만 고치고 AI 9 미룬 송구 검사로 이어지는 갈래 — AI 0 · 1 · 0xc · 0xf */
const STEERING_AI: Readonly<Partial<Record<number, FielderAiStep>>> = {
  [AI_STATE.IDLE]: (s, _t, slot, self) => idleAi(s, slot, self),
  [AI_STATE.CHASE]: chaseAi,
  [AI_STATE.BACKUP]: (s, _t, slot, self) => backupAi(s, slot, self),
  [AI_STATE.RETURN]: (s, _t, slot) => returnAi(s, slot),
}

/** b46c2~b475a 다이빙 검사 — 분기 앞에서 칸마다 (`diveCheckOf`, r180) */
function applyDiveCheck(s: DefensePlayState, t: TickFrame, slot: number): DiveCheck | null {
  const dive = diveCheckOf({
    fielder: s.fielders[slot],
    diveTick: s.diveTicks[slot] ?? DIVE_TICK_NONE,
    catchTick: s.diveCatchTick,
    // 공+0x68 — 쥔 동안은 0x3f378(3f3aa)이 안 올려 쥔 틱(첫 포구 = +0x174)에 머문다
    ballTick: (s.play.held ? Math.min(t.tick, s.catchTick) : t.tick) - s.ballLaunchTick,
    coverNeeded: (base) => needsCover(contextAt(s, t.tick), base),
    ballPointAt: (at) => s.trajectory.pointAt(s.ballLaunchTick + at),
  })
  if (dive === null) return null
  const before = s.fielders[slot]
  s.fielders = s.fielders.map((fielder) => (fielder.slot === slot ? dive.fielder : fielder))
  logDiveCheck(s.log, t.tick, slot, before, dive)
  return dive
}

/** AI 9 b4838 — 미룬 송구: 받을 야수가 송구보다 먼저 닿으면 그 루로 보내고(0xb2c90) 참이면 b48ac 이 AI 0 */
function rollDeferredThrow(s: DefensePlayState, t: TickFrame, slot: number, self: FielderState): void {
  if (s.deferredThrowReceiver === NONE || self.aiState !== AI_STATE.RECEIVE) return
  const receiver = s.fielders[s.deferredThrowReceiver]
  const holder = s.fielders[s.play.ballHolderSlot]
  if (receiver === undefined || holder === undefined) return
  if (fielderArrivalTicks(receiver) > throwTicksTo(holder, basePosition(s.deferredThrowBase))) return
  const sent = rollSendToBase(s, t, s.play.ballHolderSlot, s.deferredThrowBase, '미룬', false)
  if (sent) s.fielders = s.fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, aiState: AI_STATE.IDLE } : fielder))
}
