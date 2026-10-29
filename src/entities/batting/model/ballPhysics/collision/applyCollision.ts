import type { RandomPort } from '@/shared/api/random/randomPort'
import type { CollisionResult } from '@/entities/batting/model/ballPhysics/collision/stadium'
import { WALL_FACE_HEIGHT } from '@/entities/batting/model/ballPhysics/constants'
import { bounce } from '@/entities/batting/model/ballPhysics/flight/tick'
import { divide, multiply } from '@/entities/batting/model/ballPhysics/integerMath'
import type { BallBody, MutableEvents, RollCount } from '@/entities/batting/model/ballPhysics/types'

/** 담장 면에 맞고 꺾인 공의 v0 배율 (a2c9a 0xaa = 170%) */
const WALL_VERTICAL_SPEED_PERCENT = 170

/**
 * 0xa2bf0 (보조 인터페이스 A 의 0x20) — S7 6-3 의 네 갈래.
 * ```
 * +0x2a → aa4 = t(처음만)
 * +0x29 → aa4 = t(처음만) · ac0 = 0
 * +0x28 → ab0 = t(처음만) · 각 = r.각 + rand(−25, 25) · 위치 = r · a9c = 1 · +0x48 = v0 · 속도 >>= 1 · +0x51 = 0
 *         ab0 < aa0 → +0x52 = 1
 * 그 밖 → r.y > 1999 면 아무것도 안 함 · aa8 = t(처음만) · 각 = r.각 · x·z = r · a9c = 1
 *         +0x48 = v0 = v0·170/100 · 속도 >>= 1 · +0x51 = 1 · vt3c(0xa292c)
 * ```
 */
export function applyCollision(
  body: BallBody,
  events: MutableEvents,
  tick: number,
  result: CollisionResult,
  random: RandomPort | undefined,
  rolls: RollCount,
): void {
  if (!result.hit) return
  if (result.overStand) {
    events.fenceTick = firstTickOf(events.fenceTick, tick)
    return
  }
  if (result.overFence) {
    events.fenceTick = firstTickOf(events.fenceTick, tick)
    events.carryScale = 0
    return
  }
  if (result.pole) {
    applyPoleHit(body, events, tick, result, rollPoleDeflection(random, rolls))
    return
  }
  if (result.y > WALL_FACE_HEIGHT) return
  applyWallHit(body, events, tick, result)
}

/** 사건 틱은 처음 한 번만 적는다 (−1 일 때만) */
function firstTickOf(current: number, tick: number): number {
  return current === -1 ? tick : current
}

/** 0xbfa54 rand(−25, 25). 난수를 안 주면 굴리지 않고 0 으로 둔다(웹 규약 — `trajectoryWithRandom` 이 다시 돈다) */
function rollPoleDeflection(random: RandomPort | undefined, rolls: RollCount): number {
  rolls.count += 1
  return random === undefined ? 0 : random.rand(-25, 25)
}

/** +0x28 폴 — 각 = r.각 + 굴림 · 위치 = r · v0 를 다음 바운드 속도로 · 속도 반 */
function applyPoleHit(body: BallBody, events: MutableEvents, tick: number, result: CollisionResult, deflection: number): void {
  events.poleTick = firstTickOf(events.poleTick, tick)
  body.angle = result.angle + deflection
  body.x = result.x
  body.y = result.y
  body.z = result.z
  body.bounceMark = 1
  body.bounceSpeed = body.verticalSpeed
  body.speed >>= 1
  body.flag51 = false
  if (events.poleTick < events.landingTick) body.flag52 = true
}

/** 담장 면 — 각 = r.각 · x·z = r · v0 ×170% · 속도 반 · 바로 바운드(vt3c 0xa292c) */
function applyWallHit(body: BallBody, events: MutableEvents, tick: number, result: CollisionResult): void {
  events.wallTick = firstTickOf(events.wallTick, tick)
  body.angle = result.angle
  body.x = result.x
  body.z = result.z
  body.bounceMark = 1
  body.verticalSpeed = divide(multiply(body.verticalSpeed, WALL_VERTICAL_SPEED_PERCENT), 100)
  body.bounceSpeed = body.verticalSpeed
  body.speed >>= 1
  body.flag51 = true
  bounce(body)
}
