import { backupPointOf } from '@/entities/fielding/model/catchPrediction'
import { claimCoverOfBase, withCoverBaseTarget } from '@/entities/fielding/model/coverAssignment'
import { FIELDER_START_POSITIONS, type WorldPoint, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { acceptsTargetVt14, isFreeToRetarget, isFreeToStep, withReturnToStartTick } from '@/entities/fielding/model/fielderPose'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/** 야수 AI 고리 한 칸의 갈래 (분기표 0xd8808[상태]) */
export type FielderAiStep = (s: DefensePlayState, t: TickFrame, slot: number, self: FielderState) => void

/** 한 칸의 목표만 갈아 끼운다 */
function retargetSlot(s: DefensePlayState, slot: number, target: WorldPoint): void {
  s.fielders = s.fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target } : fielder))
}

/**
 * AI 0 b476a — vtcc 면 목표가 시작 자리 0xd86ec[칸] 와 다를 때 vt50(= vt14)로 그 자리로 (r180 — 예전 웹은 6 절 걸음에서 골랐다).
 * 고리 안이라 같은 틱 끝 b4c72 의 커버 다시 고르기(0xb1c90)가 고친 목표를 보고, 고리 뒤에 AI 0 이 된 야수(커버 다시 고르기
 * b1d38 · b2540, CPU 송구 526ae 의 b2e14, 뒤 칸의 커버 가져가기 b2a7e)와 다이빙 검사가 AI 0 으로 내린 칸(분기는 옛 상태)은
 * 다음 목록 틱에 옛 목표로 한 걸음 더 가고 다음 고리에서 돌아선다. vt4c 가 안 도는 틱(판 종류 마스크 · 관문 G2)은 아무도 안 고친다
 */
export function idleAi(s: DefensePlayState, slot: number, self: FielderState): void {
  if (!isFreeToRetarget(self)) return
  const home = FIELDER_START_POSITIONS[slot]
  if (home !== undefined && !isSamePoint(self.target, home)) retargetSlot(s, slot, home)
}

/**
 * AI 1 b4aca~b4b5a — vtcc(b4ad2) · +0xe0 == 0(b4ae6) · 움직임 허용 +0x13c[칸](b4af6)이면 +0x127 && 낙구 틱 ≥ 공+0x68 은
 * 낙구점, 아니면 포구 틱(+0x174) 점의 (x, 0, z) 로 0xa100c(= vt14). 고리 안이라 같은 틱 끝 b4c72 의 커버 다시 고르기가
 * 고친 목표를 본다 (r190 — 예전 웹은 6 절 걸음에서 골랐다). 쥐기 전(포구 틱 갈래가 앞선 1 절에서 쥔다)만 고친다.
 * +0x13c 는 마지막 예보가 적은 값이다(`forecastMovable`, r196 — 보통 송구를 받는 야수는 안 고친다)
 */
export function chaseAi(s: DefensePlayState, t: TickFrame, slot: number, self: FielderState): void {
  if (slot !== s.chaserSlot || t.tick >= s.catchTick || !s.forecastMovable || !isFreeToRetarget(self)) return
  const landingPoint = s.trajectory.pointAt(s.ballLandingTick)
  const chaseTarget = s.landingChase && s.ballLandingTick >= t.tick ? { x: landingPoint.x, y: 0, z: landingPoint.z } : s.catchPoint
  if (!isSamePoint(self.target, chaseTarget)) retargetSlot(s, slot, chaseTarget)
}

/** AI 0xc b4b78 — 공 가진 야수(+0x130)의 목표 T 에서 2000 뒤(`backupPointOf`)로 vt14(잠금 +0xb4 ≤ 0 · vtc8 일 때만, r180) */
export function backupAi(s: DefensePlayState, slot: number, self: FielderState): void {
  const backup = backupPointOf(s.fielders[s.play.ballHolderSlot]?.target ?? self.target, self.position)
  if (backup !== null && self.actionLockTicks <= 0 && isFreeToStep(self)) retargetSlot(s, slot, backup)
}

/**
 * AI 0xf b4c2a~b4c5c — 시작 자리 0xd86ec[+0x88] 로 vt14(잠금 +0xb4 ≤ 0 · vtc8 — +0xcc ≤ 0 일 때만 받는다) 뒤 vt8c(5) =
 * 0xa0ee0: +0xcc = 5. 다음 목록 틱 a1330 이 4 로 줄여도 vtc8 이 거짓이라 걸음(a1346)이 없고 a143e 지우기가 vt10 으로 목표 = 위치,
 * 이 고리가 다시 5 를 적는다 — 사건 7 · 12 를 받은 틱 뒤로 야수는 그 자리에 선다(원본 그대로, r190)
 */
export function returnAi(s: DefensePlayState, slot: number): void {
  s.fielders = s.fielders.map((fielder) => (fielder.slot === slot ? withReturnToStartTick(fielder) : fielder))
}

/**
 * AI 0xb b4b5c — +0x90 을 [sp+0x40] 에 베껴 b482e 에서 **조건 없이** vt14(+0x90) 뒤 다음 칸(b4c60). vt14 = 0xa14c8 관문(잠금
 * +0xb4 ≤ 0 · vtc8)이 막으면 목표는 그대로다. 공 쥠 +0xe0 은 안 본다 — 쥐었어도 담장 앞으로 걷는다 (r214 — 예전 웹은 고르기에서
 * 목표에 바로 적고 vt10 지우기가 목표를 안 건드리게 해 두었다)
 */
export function pickUpAi(s: DefensePlayState, slot: number, self: FielderState): void {
  const point = self.pickUpPoint
  if (point !== undefined && acceptsTargetVt14(self) && !isSamePoint(self.target, point)) retargetSlot(s, slot, point)
}

/**
 * AI 2~5 (분기표 0xd8808[2..5] = b47f2, 직접 뜬 것, r176): +0x3b(앞 목록 틱에 목표점에 막 닿음) && vtcc 면
 * b4814 0xb2a48(P, 칸, 루) — 그 루의 커버 칸(+0xf0)이 다른 야수면 그 야수를 AI 0 으로 내리고 이 야수가 커버가 된다
 * (`claimCoverOfBase`). b4818~b482e — 조건 없이 vt14(0xd86b0[루]) — 관문(잠금 +0xb4 · vtc8)이 막으면 목표는 그대로(r201)
 */
export function coverAi(s: DefensePlayState, t: TickFrame, slot: number, self: FielderState, base: number): void {
  if (s.fielderArrivals[slot] === true && isFreeToRetarget(self)) {
    const claimed = claimCoverOfBase(s.play, s.fielders, slot, base)
    if (claimed.play !== s.play) pushPlayLog(s.log, () => `${t.tick}틱 ${slot}번 야수가 ${base}루 커버를 가져간다 (b4814 0xb2a48)`)
    s.play = claimed.play
    s.fielders = claimed.fielders
  }
  s.fielders = withCoverBaseTarget(s.fielders, slot, base)
}
