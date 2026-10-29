import { type WorldPoint, basePosition } from '@/entities/fielding/model/fieldGeometry'
import { isReadyToThrow } from '@/entities/fielding/model/fielderPose'
import { type FielderState, NONE } from '@/entities/fielding/model/fieldingState'
import { type ThrowPlan, planThrow } from '@/entities/fielding/model/throwPlan'
import { takeLooseBall } from '@/features/defense-play/model/defensePlay/ball/takeLooseBall'
import { runCoverOnce } from '@/features/defense-play/model/defensePlay/cover/coverOnce'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import { NO_CPU_SPECIAL_THROW, cpuSpecialThrowOf } from '@/features/defense-play/model/defensePlay/throw/cpuSpecialThrow'
import { deferThrow, isReceiverLate } from '@/features/defense-play/model/defensePlay/throw/deferThrow'
import { releaseThrow, rollLaunchThrow } from '@/features/defense-play/model/defensePlay/throw/launchFromHand'
import type { ThrowChooser } from '@/features/defense-play/model/defensePlay/throw/throwChooser'
import { throwLogOf } from '@/features/defense-play/model/defensePlay/throw/throwLog'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { type ThrownBall, forecastOptionsOf } from '@/features/defense-play/model/throwLaunch'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **송구 0xb2e38**(플레이.vt5c, 인자 받을 야수 C · 특수) — 공 가진 야수가 C 에게 던진다. 던졌거나 미뤘으면(AI 9) 참.
 * 부르는 곳은 루로 보내기 0xb2c90(`rollSendToBase`)과 중계 이어 던지기 b4616 둘이다. 직접 뜬 것:
 * ```
 * b2e44: 공가진야수.vtC4()(준비, +0xc8 ≤ 0) 가 거짓이면 0
 * b2e6c: +0x154 = C ; +0x134 = +0x130 ; vt8c = 0xb3444 송구 계획 → +0x14c..+0x153 ([0] 중계 [1] 특수 [2] 던지는 야수
 *        [3] 받는 야수(중계면 중계맨) [4] 최종 받는 야수 [5] 1구간 틱 [6] 전체 틱 [7] 목표 루)
 * b2eb2: R = 야수[[3]] ; !R.vt18()(목표점에 없음) && R.vtc0() > [5] → b30a2 미루기:
 * b30a2:   공가진야수 AI == 9 → 0 / 아니면 +0x15c = [3] · +0x158 = [7] · AI 9 · 공가진야수.vt48([7]) ; 1
 * b2ee6: [3] ≤ 5 && [2] ≤ 5 → 플레이.vt64(0)(+0x1f4 레이저 = 0) · [1] = 0      ; 내야 → 내야는 레이저가 없다
 * b2f06: +0x1f4 면 vtb0 = 0xa222c(레이저) 뒤 vt64(0), 아니면 vtac = 0xa1620([1]) — 공은 R 의 목표점(+0x2c)으로
 * b2f80: 공가진야수+0xe0 = 0 ; b3070 +0x12c = 0 ; b307c vt24(0) 포구 예보 ; vt30 = 0xb1c90 ; 1
 * ```
 * 중계([0])면 받는 야수는 중계맨이고, 그가 쥐면(쥐기 0xb2710 — 준비 틱 내야 3) 플레이 틱 b4616 이 [4] 에게 다시 0xb2e38
 * 을 부른다(1a 절). 공은 0xa1620(레이저 0xa222c)이 쏘고 b2f8c 의 세계 0xbfed0 이 깐 뒤 b2f9c 가 점[T − 1] 에 받는 점을
 * 끼워 넣는다(`launchThrow`). 받는 야수 · 받는 틱은 b307c 예보 vt24(0) · 고르기 vt34 가 정하고, 받는 것은 보통 포구 틱
 * 갈래(1 절 — 펌블 굴림 b4228 · 쥐기 0xb2710 · 펌블이면 0xb3148 튕김)다. 원바운드(a17fc)도 같은 공(공+0xaac = 1)이다.
 */
export function rollThrowBall(
  s: DefensePlayState,
  t: TickFrame,
  fromSlot: number,
  coverSlot: number,
  base: number,
  chooser: ThrowChooser,
  cpuSpecial: boolean,
): boolean {
  const holder = s.fielders[fromSlot]
  if (holder === undefined || s.fielders[coverSlot] === undefined || !canThrowNow(holder)) return false
  // 레이저 송구 — 반짝임 창 안에 새로 누른 키가 들어왔고 공을 쥐었으면 +0x1f4 (0x400bc)
  // b2f06 — 레이저 발사 0x400bc 가 세운 플레이+0x1f4 를 본다(발사는 슬롯 2 머리에서 따로 — 0b 절 끝)
  const plan = planThrow({ fielders: s.fielders, fromSlot, finalSlot: coverSlot, base, special: s.laserArmed || cpuSpecial })
  // b2e92~b2ea0: 계획을 +0x14c.. 에 덮어쓴다 — **미루기 검사(b2eb2) 앞**이라 미뤄도 새 계획이다(r214 — 예전 웹은 던질 때만 적었다).
  // 중계면 [0] = 1 · [4] = 최종 받는 야수 (b4616 이 본다). 레이저 · 특수는 0xb3444 가 중계를 안 끼운다(b3528)
  s.relayFinalSlot = plan.relayed ? coverSlot : NONE
  s.relayBase = plan.relayed ? base : NONE
  if (isReceiverLate(s, plan)) return deferThrow(s, t, holder, plan, chooser)
  rollThrowNow(s, t, { fromSlot, coverSlot, base, chooser, cpuSpecial }, plan)
  return true
}

interface ThrowOrder {
  readonly fromSlot: number
  readonly coverSlot: number
  readonly base: number
  readonly chooser: ThrowChooser
  readonly cpuSpecial: boolean
}

/** 미루지 않은 송구 — 쏘고(0xa1620 · 0xa222c) · 손을 떠나고(b2f80) · 받을 야수를 예보한다(b307c) */
function rollThrowNow(s: DefensePlayState, t: TickFrame, order: ThrowOrder, plan: ThrowPlan): void {
  const { fromSlot, coverSlot, base } = order
  const laser = armedLaserFor(s, plan, fromSlot)
  // CPU 홈 송구 20% 특수 송구 — 효과는 `cpuSpecialThrowOf` 참고. 레이저는 0xb2e38 이 다른 함수로 던진다(`rollLaunchThrow`)
  const special = !laser && order.cpuSpecial ? cpuSpecialThrowOf(s.fielders, fromSlot, coverSlot) : NO_CPU_SPECIAL_THROW
  const relaySlot = plan.relayed && !laser && !special.special ? plan.toSlot : NONE
  const thrown = rollLaunchThrow(s, { fromSlot, target: throwTargetOf(s, plan, base), laser, special })
  releaseThrow(s, t, { fromSlot, base, firstReceiver: relaySlot === NONE ? coverSlot : relaySlot })
  catchForecastAfterThrow(s, t, thrown, fromSlot, coverSlot)
  if (s.firstThrowBase === NONE) {
    s.firstThrowBase = base
    s.firstThrowArrivalTick = s.throwArrivalTick
  }
  const facts = { tick: t.tick, base, laser, cpuSpecial: order.cpuSpecial, arrivalTick: s.throwArrivalTick, relaySlot }
  pushPlayLog(s.log, () => throwLogOf({ ...facts, bounce: special.bounce, thrown, chaserSlot: s.chaserSlot, chooser: order.chooser, fromSlot }))
}

/** 공은 송구 계획 [3](중계면 중계맨, b2ea8)의 목표점(+0x2c)으로 쏜다 */
function throwTargetOf(s: DefensePlayState, plan: ThrowPlan, base: number): WorldPoint {
  return s.fielders[plan.toSlot]?.target ?? basePosition(base)
}

/**
 * vtC4 = 0xa20ec(+0xb0 == 0 && +0xb4 ≤ 0 && +0xc8 ≤ 0). 던지기 0xa1620 은 끝(a1a32)에서 야수+0xb1 = 1 을 세워
 * +0xb0 워드를 0 이 아니게 만든다 — 던진 야수는 그 동작이 끝날 때까지 vtC4 가 거짓이라 다시 못 던진다.
 * 그 잠금은 다음 야수 틱 0xa1284 의 a1406~a141a(`vtc8()` 거짓 → a143e)에서 걸음 없이 풀린다(U-78 — `fielderPose.listTickFielder`).
 * 웹은 공을 안 쥔 야수는 못 던지는 것으로 본다(0xa1620 머리 a165a 도 공 칸 +0xd0 이 비면 0 을 돌려준다).
 */
function canThrowNow(holder: FielderState): boolean {
  return holder.holdingBall && isReadyToThrow(holder)
}

/** b2ee6: 내야수 → 내야수 송구면 레이저 표시를 지운다 (vt64(0)). 남은 레이저로 던지면 판에 레이저 송구가 있었다고 적는다 */
function armedLaserFor(s: DefensePlayState, plan: ThrowPlan, fromSlot: number): boolean {
  if (plan.toSlot <= 5 && fromSlot <= 5) {
    s.laserArmed = false
    return false
  }
  if (s.laserArmed) s.laserThrow = true
  return s.laserArmed
}

/**
 * b307c vt24(0) — +0x130 = 던진 야수(t ≤ 4 건너뜀) · 그 복제는 +0xb1(a1a3a)로 첫 복제 틱 하나 더 빠진다 · a = 0 이라 궤적 끝까지
 * 못 줍으면 t = 10 부터 두 번째 패스 · vt34 = 0xb3b38 이 받을(주울) 야수를 AI 1 로. 받는 틱 = 그 포구 틱이다.
 * 보통 · 흔들린 · 레이저 송구는 공+0xaac = 0 이라 움직임허용 없음(복제가 제자리 · n 없음)이고, 던진 야수 · C(+0x154)가
 * 둘 다 내야(칸 ≤ 5)면 +0x1e8 = 1(b305a~b306c) — C 만 낮은 공 · 가슴 높이로 잡는다. 악송구는 움직임허용 모두 · +0x1e8 없음.
 * b3094 vt30 = 0xb1c90 — 고르기 vt34 뒤의 공 가진 야수(받을 야수)로 커버를 다시 고른다 (r171)
 */
function catchForecastAfterThrow(s: DefensePlayState, t: TickFrame, thrown: ThrownBall, fromSlot: number, coverSlot: number): void {
  takeLooseBall(s, t, thrown.ball, forecastOptionsOf(thrown, fromSlot, coverSlot))
  s.receivingThrow = !thrown.loose
  s.throwArrivalTick = s.catchTick
  runCoverOnce(s, t)
}
