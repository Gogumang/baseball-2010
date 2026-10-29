import { type WorldPoint, stepToward } from '@/entities/fielding/model/fieldGeometry'
import { POSE, isFreezeOpen, shouldClearPose, withThrowMotion } from '@/entities/fielding/model/fielderPose'
import type { FielderState } from '@/entities/fielding/model/fieldingState'

/** 복제 하나 — 원본 0xb12d0 이 야수마다 new 0xf4 + 0xa0e08 로 통째 베낀 칸 */
export interface ForecastClone {
  position: WorldPoint
  runTicks: number
  lockTicks: number
  slackTicks: number
  /** 자세 워드 +0xb0 (`fielderPose.POSE`) */
  pose: number
  /** 동작 +0xa8 */
  action: number
  /** 동작 프레임 +0xac */
  frame: number
  /**
   * 복제의 목표점 +0x2c — 진짜 야수의 것을 물려받는다. vt10(0xa124c → 0xbf2b0)이 제 위치로 둔다: 정지 판정(b14d0) ·
   * 자세 워드를 지운 틱(a143e) · 동작 잠금 +0xb4 가 0 이 된 틱(a12c8)
   */
  target: WorldPoint
}

/**
 * 복제 9명 — 위치 · n · 동작 잠금 +0xb4 · +0xcc 를 원본 복제처럼 따로 굴린다.
 * 자세 워드 +0xb0 · 동작 +0xa8 · 프레임 +0xac 도 베낀다(r171 — 복제 틱이 원본 야수 틱 0xa1284 를 통째로 돈다, `fielderPose`).
 * 던진 야수(`thrownSlot`)는 던지기 끝(a1a26~a1a3a)의 동작 5 · +0xb1 을 얹는다 — 진행기가 이미 세웠으면 같은 값이다
 */
export function forecastClonesOf(fielders: readonly FielderState[], thrownSlot: number | undefined): ForecastClone[] {
  return fielders.map((fielder): ForecastClone => {
    const thrown = fielder.slot === thrownSlot ? withThrowMotion(fielder) : fielder
    return {
      position: fielder.position,
      runTicks: 0,
      lockTicks: fielder.actionLockTicks,
      slackTicks: fielder.arrivalSlackTicks,
      pose: thrown.pose,
      action: thrown.action,
      frame: thrown.actionFrame,
      target: fielder.target,
    }
  })
}

/** b146c — vtc8(+0xb1 == 0 && +0xcc ≤ 0) && +0xb4 ≤ 0: 판정 · vt14 를 받는 복제 */
export function isCloneUnlocked(clone: ForecastClone): boolean {
  return (clone.pose & POSE.THROWN) === 0 && clone.slackTicks <= 0 && clone.lockTicks <= 0
}

/**
 * 복제의 야수 틱 0xa1284 — 프레임 +1(a1286) · 동작 잠금이 있으면 −1 만 하고 끝(a12b4~a12d6, 0 이 되면 vt10), 아니면 +0xcc −1(a1330)
 * 뒤 이동 관문(0xa0f7c && vtc8 && +0xb4 ≤ 0, a1346~a1376)이 서면 목표로 한 틱(기반 캐릭터 이동 0xbf158 = `stepToward`), 끝에
 * 지우기 규칙(a137a~a143e — `fielderPose.shouldClearPose`: 던진 뒤 +0xb1 이면 vtc8 거짓으로 곧바로)이 서면 워드 · 동작 0 · vt10(목표 = 위치).
 * 던진 야수의 첫 복제 틱은 그래서 걸음 없이 풀린다(U-78, 에뮬 확인 — 동작 5 · +0xac 0 · +0xb1 1 로 한 번 돌리면 +0xb1 = 0 · 동작 0 ·
 * 위치 그대로). 점프 · 가슴 높이 포구 동작 중인 복제는 프레임 1 · 2 에만 걷는다.
 */
export function tickClone(clone: ForecastClone, speed: number): void {
  clone.frame += 1
  if (clone.lockTicks > 0) {
    tickLockedClone(clone)
    return
  }
  // a1330 — +0xcc 를 먼저 줄이고 a1346 의 vtc8 이 같은 틱에 본다
  if (clone.slackTicks > 0) clone.slackTicks = Math.max(0, clone.slackTicks - 1)
  // a1346 이동은 0xa0f7c · vtc8(+0xb1 · +0xcc) 뒤 · a143e 의 지우기는 이동 뒤다
  if (isFreezeOpen(clone.pose, clone.frame) && (clone.pose & POSE.THROWN) === 0 && clone.slackTicks <= 0) {
    clone.position = stepToward(clone.position, clone.target, speed)
  }
  if (shouldClearPose({ pose: clone.pose, action: clone.action, actionFrame: clone.frame, arrivalSlackTicks: clone.slackTicks })) {
    // a143e — +0xb0~+0xb3 지우기 · vt10(목표 = 위치 · 동작 0)
    clearClonePose(clone)
  }
}

/** a12b4~a12d6 — 동작 잠금이 있으면 −1 만 하고 끝. a12c8~a12d2 — 잠금이 막 0 이 된 틱은 vt10(0xa124c → 0xbf2b0 목표 = 위치 · 동작 · 워드 0) */
function tickLockedClone(clone: ForecastClone): void {
  clone.lockTicks -= 1
  if (clone.lockTicks <= 0) clearClonePose(clone)
}

/** vt10 — 목표 = 위치 · 자세 워드 · 동작 0 */
function clearClonePose(clone: ForecastClone): void {
  clone.target = clone.position
  clone.pose = 0
  clone.action = 0
}
