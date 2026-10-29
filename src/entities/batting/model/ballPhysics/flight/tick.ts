import { cosineSixteen, integerSquareRoot, sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import { divide, multiply } from '@/entities/batting/model/ballPhysics/integerMath'
import type { BallBody, BallPoint } from '@/entities/batting/model/ballPhysics/types'

/** 0xbee24 */
function bounceSpeedOf(body: BallBody): number {
  if (body.gravity <= 0) return 0
  const v0 = body.verticalSpeed
  const root = integerSquareRoot(multiply(v0, v0) + (multiply(body.y, body.gravity) << 1))
  return root - v0 + Math.abs(v0)
}

/** 0xa28c0 */
function fly(body: BallBody): void {
  body.x += multiply(cosineSixteen(body.angle), body.speed) >> 16
  body.z += multiply(sineSixteen(body.angle), body.speed) >> 16
  const t = body.flightTick + 1
  body.flightTick = t
  const y = body.originY + multiply(body.verticalSpeed, t) - (multiply(t, multiply(body.gravity, t)) >> 1)
  body.y = y < 0 ? 0 : y
  body.bounceMark = 0
}

/** 0xa292c (공 vt3c) · 0xbf348 */
export function bounce(body: BallBody): void {
  if (body.landedThisTick) {
    body.bounceSpeed = divide(multiply(body.bounceVerticalPercent, body.bounceSpeed), 100)
    body.verticalSpeed = body.bounceSpeed
    body.speed = divide(multiply(body.bounceHorizontalPercent, body.speed), 100)
    return
  }
  if (body.verticalSpeed !== 0) {
    body.bounceSpeed = divide(multiply(body.bounceVerticalPercent, body.bounceSpeed), 100)
    body.verticalSpeed = body.bounceSpeed
    body.flag51 = false
    body.speed = divide(multiply(body.bounceHorizontalPercent, body.speed), 100)
  } else {
    body.bounceSpeed = divide(multiply(body.restVerticalPercent, body.bounceSpeed), 100)
    body.verticalSpeed = body.bounceSpeed
    body.speed = divide(multiply(body.rollPercent, body.speed), 100)
  }
}

/** 0xbf240 (vt28) */
function touchGround(body: BallBody): void {
  body.landedThisTick = false
  if (body.y > 0) body.onGround = false
  else landOnGround(body)
  if (body.onGround && body.bounces) bounce(body)
}

/** 0xbf240 의 y ≤ 0 갈래 — 기준점을 지금 위치로 · 바운드면 다음 v0 · 땅에 처음 닿았으면 착지 표시 */
function landOnGround(body: BallBody): void {
  body.y = 0
  body.originX = body.x
  body.originY = 0
  body.originZ = body.z
  body.verticalSpeed = body.bounces ? body.bounceSpeed : 0
  if (body.bounces) body.flightTick = 0
  if (body.onGround) return
  body.landedThisTick = true
  body.onGround = true
}

/** 0xa27f0 — 지금 점의 속도 워드가 0 이고 (높이 0 이거나 목표에 섰다) */
export function isStoppedPoint(body: BallBody, point: BallPoint | undefined): boolean {
  if (point === undefined) return false
  if ((point.speed & 0xffff) !== 0 || (point.verticalSpeed & 0xffff) !== 0) return false
  if (body.y === 0) return true
  return body.x === body.targetX && body.y === body.targetY && body.z === body.targetZ
}

/** 0xbf094 (공 vtC) */
export function step(body: BallBody, current: BallPoint | undefined): void {
  if (body.frozen) return
  body.stoppedThisTick = false
  body.landedThisTick = false
  if (isStoppedPoint(body, current)) return
  // 0xbf0dc
  body.stoppedThisTick = false
  if ((body.stopped && !isStoppedPoint(body, current)) || body.relaunched) {
    body.relaunched = false
    body.stopped = false
    body.bounceSpeed = bounceSpeedOf(body)
    body.flightTick = 0
  }
  fly(body)
  const wasStopped = body.stopped
  body.stopped = isStoppedPoint(body, current)
  if (body.stopped && !wasStopped) body.stoppedThisTick = true
  touchGround(body)
}
