import type { RandomPort } from '@/shared/api/random/randomPort'
import { applyCollision } from '@/entities/batting/model/ballPhysics/collision/applyCollision'
import { collideWithStadium } from '@/entities/batting/model/ballPhysics/collision/collideWithStadium'
import {
  BALL_LAUNCH_POINT,
  CARRY_SCALE_DIVISOR,
  CARRY_SCALE_MAXIMUM,
  DEEP_HIT_DISTANCE,
  DEEP_HIT_ORIGIN,
  MAXIMUM_BALL_POINTS,
} from '@/entities/batting/model/ballPhysics/constants'
import { isStoppedPoint, step } from '@/entities/batting/model/ballPhysics/flight/tick'
import { divide, toShort } from '@/entities/batting/model/ballPhysics/integerMath'
import { horizontalDistance } from '@/entities/batting/model/ballPhysics/otherSlices'
import type { BallBody, BallFlight, BallPoint, MutableEvents, RollCount } from '@/entities/batting/model/ballPhysics/types'

/** 각이 [−135, −45] — 페어 지역 (a29f4 · a2a88 `(각 + 135) as u32 ≤ 90`) */
function isFairAngle(angle: number): boolean {
  return (angle + 135) >>> 0 <= 90
}

/** 0xa29bc — 점을 적고 낙구 · ac4 를 본다. i > 129 면 거짓 */
function recordPoint(body: BallBody, points: BallPoint[], events: MutableEvents, index: number): boolean {
  if (index > MAXIMUM_BALL_POINTS - 1) return false
  const point: BallPoint = {
    x: body.x,
    y: body.y,
    z: body.z,
    speed: toShort(body.speed),
    verticalSpeed: toShort(body.verticalSpeed),
    angle: toShort(body.angle),
    bounceMark: body.bounceMark,
  }
  points.length = index + 1
  points[index] = point
  const isFirstLanding = point.y <= 0 && events.landingTick === -1 && index > 0
  if (isFirstLanding) markLanding(body, point, events, index)
  return true
}

/** a29f4 — 처음 땅에 닿은 점 aa0 · 페어 타구가 홈에서 10274 넘게 떨어졌으면 ac4 = 1 */
function markLanding(body: BallBody, point: BallPoint, events: MutableEvents, index: number): void {
  events.landingTick = index
  if (isFairAngle(body.angle) && horizontalDistance(DEEP_HIT_ORIGIN, point) > DEEP_HIT_DISTANCE) events.deepHit = true
}

/**
 * 물리 세계 0xbfed0 — 공을 끝까지(멈추거나 130 점) 돌려 점을 깐다.
 * `body` 는 **제자리에서** 바뀐다(원본 공 객체처럼 다음 발사가 이어 받는다).
 */
export function simulateBall(body: BallBody, random?: RandomPort): BallFlight {
  const points: BallPoint[] = []
  const events: MutableEvents = {
    landingTick: -1,
    fenceTick: -1,
    wallTick: -1,
    poleTick: -1,
    carryScale: 0,
    deepHit: false,
  }
  const rolls: RollCount = { count: 0 }
  body.bounceMark = 0
  recordPoint(body, points, events, 0)
  let index = 1
  while (!isStoppedPoint(body, points[points.length - 1])) {
    step(body, points[points.length - 1])
    if (!recordPoint(body, points, events, index)) break
    const result = collideWithStadium(points[Math.max(0, index - 1)], points[index])
    if (result.hit) {
      applyCollision(body, events, index, result, random, rolls)
      recordPoint(body, points, events, index)
    }
    index += 1
  }
  // 0xa2a88 마무리
  const count = Math.min(index, MAXIMUM_BALL_POINTS)
  points.length = Math.min(points.length, count)
  const clearedFairFence = events.fenceTick !== -1 && events.landingTick !== -1 && isFairAngle(body.angle)
  if (clearedFairFence) events.carryScale = carryScaleOf(points, events.landingTick)
  return { points, events, randomRolls: rolls.count, body }
}

/** a2a88 — ac0 = min(|점(aa0) − (20000,1000,30000)| / 265, 160) */
function carryScaleOf(points: readonly BallPoint[], landingTick: number): number {
  const landing = points[Math.min(landingTick, points.length - 1)]
  return Math.min(divide(horizontalDistance(BALL_LAUNCH_POINT, landing), CARRY_SCALE_DIVISOR), CARRY_SCALE_MAXIMUM)
}

/** 점 t (0xa2b78 — 0 ~ 개수−1 로 자른다) */
export function ballPointAt(points: readonly BallPoint[], tick: number): BallPoint {
  return points[Math.max(0, Math.min(points.length - 1, Math.trunc(tick)))]
}

/**
 * 재생 중 멈춤 판정 — 공 vt18 = 0xa27f0 를 공+0x68 = `tick` 에서 부른 것.
 * 재생(0x3f3c6 → 0xa2594)은 +0x68 만 올리고 공 위치(+0x20)는 안 건드리므로, 높이·목표 비교는
 * **미리 계산이 끝난 공**의 칸으로 한다 (멈춰서 끝난 공은 높이 0).
 */
export function isBallStoppedAt(points: readonly BallPoint[], tick: number, body: BallBody): boolean {
  const point = ballPointAt(points, tick)
  if (point.speed !== 0 || point.verticalSpeed !== 0) return false
  if (body.y === 0) return true
  return body.x === body.targetX && body.y === body.targetY && body.z === body.targetZ
}
