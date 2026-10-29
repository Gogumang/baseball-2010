import { BATTED_BALL_PHYSICS } from '@/shared/config/original/battedBallPatterns'
import { divide, multiply } from '@/entities/batting/model/ballPhysics/integerMath'
import type { WorldPoint } from '@/entities/batting/model/ballPhysics/otherSlices'
import type { BallBody } from '@/entities/batting/model/ballPhysics/types'

// ── 공 만들기 · 놓기 · 쏘기 ───────────────────────────────────────────────

/** 공 생성 0xa26e4 → 기반 0xbec84 · 0xa267c, 장면 초기화 0x3edd0 의 pattern.dat 머리 값 */
export function createBallBody(): BallBody {
  return {
    x: 0,
    y: 0,
    z: 0,
    originX: 0,
    originY: 0,
    originZ: 0,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    speed: 100,
    verticalSpeed: 0,
    gravity: BATTED_BALL_PHYSICS.gravity,
    bounceSpeed: 0,
    flightTick: 0,
    angle: 0,
    bounceHorizontalPercent: BATTED_BALL_PHYSICS.bounceHorizontalPercent,
    bounceVerticalPercent: BATTED_BALL_PHYSICS.bounceVerticalPercent,
    rollPercent: BATTED_BALL_PHYSICS.rollPercent,
    restVerticalPercent: BATTED_BALL_PHYSICS.restVerticalPercent,
    onGround: true,
    landedThisTick: false,
    stopped: false,
    stoppedThisTick: false,
    frozen: false,
    flag51: false,
    flag52: false,
    bounces: true,
    relaunched: true,
    bounceMark: 0,
  }
}

export function cloneBallBody(body: BallBody): BallBody {
  return { ...body }
}

/** 0xbef58 — 위치와 기준점을 놓고, 목표(+0x2c)와 다르면 목표를 옮기고 +0x54 = 1 (0xbf2cc) */
export function placeBall(body: BallBody, point: WorldPoint): void {
  body.x = point.x
  body.y = point.y
  body.z = point.z
  body.originX = point.x
  body.originY = point.y
  body.originZ = point.z
  if (body.targetX !== point.x || body.targetY !== point.y || body.targetZ !== point.z) {
    body.targetX = point.x
    body.targetY = point.y
    body.targetZ = point.z
    body.relaunched = true
  }
}

/** 공 vt14 = 0xbf2cc — 목표(+0x2c)가 다르면 옮기고 +0x54 = 1. 송구 0xa1620 이 놓은 뒤(0xbef58) 받는 점으로 부른다(a1a0e) */
export function aimBall(body: BallBody, point: WorldPoint): void {
  if (body.targetX === point.x && body.targetY === point.y && body.targetZ === point.z) return
  body.targetX = point.x
  body.targetY = point.y
  body.targetZ = point.z
  body.relaunched = true
}

/**
 * 0xa279c(공, c) — 중력 +0x44 를 +0xab8 에 맡기고 `g·c / 100` 으로 바꾼 뒤 +0xabc = 1. 송구 0xa1620(a1708)이 칸 ≤ 5 면 cfg+0x1c(70),
 * 아니면 cfg+0x1e(80)로 부르고, 세계 마무리 0xa2a88 의 a2b14~a2b28 이 +0xabc 면 되돌린다 — 그래서 점은 바뀐 중력으로 깔린다.
 * 돌려주는 값이 맡긴 중력이다(`restoreGravity` 에 넘긴다).
 */
export function scaleGravity(body: BallBody, percent: number): number {
  const saved = body.gravity
  body.gravity = divide(multiply(saved, percent), 100)
  return saved
}

/** 0xa2a88 a2b14~a2b28 — 맡긴 중력(+0xab8)을 되돌린다 */
export function restoreGravity(body: BallBody, saved: number): void {
  body.gravity = saved
}

/** vt44 = 0xa2870(속도, v0, 각) — 0xbec7c 로 +0x3c · +0x40, +0x70 = 각, +0x54 = 1 */
export function launchBall(body: BallBody, speed: number, verticalSpeed: number, angle: number): void {
  body.bounceMark = 0
  body.speed = speed
  body.verticalSpeed = verticalSpeed
  body.angle = angle
  body.relaunched = true
}
