import { POLE_HEIGHT, WALL_FACE_HEIGHT } from '@/entities/batting/model/ballPhysics/constants'
import { arctangentOfSlope, multiply, toShort } from '@/entities/batting/model/ballPhysics/integerMath'
import {
  FIRST_BASE_STAND,
  NO_COLLISION,
  OUTFIELD_FENCE,
  THIRD_BASE_STAND,
  crossingOf,
  type CollisionResult,
  type Crossing,
  type Segment,
} from '@/entities/batting/model/ballPhysics/collision/stadium'
import type { BallPoint } from '@/entities/batting/model/ballPhysics/types'

/** 외야 담장 마디 중 양 끝이 무한 직선인 두 마디 (9f880 — 0 · 6 은 x 범위를 안 거른다) */
const OPEN_ENDED_FENCE_SEGMENTS: readonly number[] = [0, 6]
/** 9fabc — 파울 관중석을 보는 x 여유 */
const STAND_MARGIN = 500

/**
 * 장애물 0x9f750(vtable 0xd7654) 의 vt8 = **0x9f7e8** — 경기장 충돌 검사.
 *
 * ```
 * 9f820 prev 의 바운드 표시(a9c) ≠ 0 → 둘 다 건너뜀 (꺾인 바로 다음 틱은 안 본다)
 * ── 1. 외야 담장 0xd7688 (cur 각 a ∈ [−180, 0] 일 때만) ──
 * 9f83e a ≥ −90 → 마디 3..6, 아니면 0..3 · 처음 맞은 마디에서 멈춘다
 * 9f880 마디 1~5 는 prev.x · cur.x 가 둘 다 [x1, x2] 밖이면 건너뜀 (0 · 6 은 무한 직선)
 * 9fa0a φ = atan(기울기) 를 마디 방향으로 사분면 보정 · 새 각 = 2φ − a
 * 9fa4a 높이 > 1999 → (a == −45 || a == −135) && 높이 ≤ 7000 이면 폴(+0x28) · 높이 = (prev.y + cur.y)/2
 *                     폴이 아니면 담장 위로 넘음(+0x29)
 * ── 2. 홈 둘레 파울 관중석 (1 에서 안 맞았을 때) ──
 * 9fabc cur.x < 11480+500 → 3루 쪽 0xd7674 · cur.x > 28520−500 → 1루 쪽 0xd7660 · 그 사이 없음
 * 9fca0 r6 = atan(m1) · r3 = atan((m2 − m1) + m1·m2) ← 원본 그대로(분모가 아니라 더한다)
 *       a < 0 → (z2 > z1 ? r3 + a : a − r3) · a ≥ 0 → 180 − a
 * 9fcec 높이 > 1999 → 관중석 위로 넘음(+0x2a)
 * ```
 */
export function collideWithStadium(previous: BallPoint, current: BallPoint): CollisionResult {
  if (previous.bounceMark !== 0) return NO_COLLISION
  const angle = toShort(current.angle)
  // ── 1. 외야 담장 ──
  const fence = isTowardOutfield(angle) ? fenceCollisionOf(previous, current, angle) : null
  // ── 2. 파울 관중석 ──
  return fence ?? standCollisionOf(previous, current, angle)
}

/** 9f83e — cur 각 a ∈ [−180, 0] 일 때만 외야 담장을 본다 */
function isTowardOutfield(angle: number): boolean {
  return ((angle + 180) & 0xffff) <= 180
}

/** 9f83e a ≥ −90 → 마디 3..6, 아니면 0..3 · 처음 맞은 마디에서 멈춘다 */
function fenceCollisionOf(previous: BallPoint, current: BallPoint, angle: number): CollisionResult | null {
  const [from, to] = angle + 90 >= 0 ? [3, 7] : [0, 4]
  for (let index = from; index < to; index += 1) {
    const segment = OUTFIELD_FENCE[index]
    if (isOutsideFenceSpan(index, segment, previous, current)) continue
    const crossing = crossingOf(segment, previous, current)
    if (crossing !== null) return fenceHitOf(segment, crossing, previous, current, angle)
  }
  return null
}

/** 9f880 마디 1~5 는 prev.x · cur.x 가 둘 다 [x1, x2] 밖이면 건너뜀 */
function isOutsideFenceSpan(index: number, segment: Segment, previous: BallPoint, current: BallPoint): boolean {
  if (OPEN_ENDED_FENCE_SEGMENTS.includes(index)) return false
  const previousInside = previous.x >= segment.x1 && previous.x <= segment.x2
  const currentInside = current.x >= segment.x1 && current.x <= segment.x2
  return !previousInside && !currentInside
}

/** 9fa0a 새 각 = 2φ − a · 9fa4a 높이 > 1999 면 폴(각 −45 · −135, 높이 ≤ 7000 — 높이는 두 점 평균) 아니면 담장 위로 넘음 */
function fenceHitOf(segment: Segment, crossing: Crossing, previous: BallPoint, current: BallPoint, angle: number): CollisionResult {
  const newAngle = fenceDirectionOf(segment, crossing.slope) * 2 - angle
  const aboveWall = crossing.y > WALL_FACE_HEIGHT
  const pole = aboveWall && isPoleAngle(angle) && crossing.y <= POLE_HEIGHT
  return {
    hit: true,
    x: crossing.x,
    y: pole ? Math.trunc((current.y + previous.y) / 2) : crossing.y,
    z: crossing.z,
    angle: toShort(newAngle),
    pole,
    overFence: aboveWall && !pole,
    overStand: false,
  }
}

/** 파울 폴이 선 각 — 파울선 그대로 (−45 1루 쪽 · −135 3루 쪽) */
function isPoleAngle(angle: number): boolean {
  return angle === -45 || angle === -135
}

/** 9fa0a φ = atan(기울기) 를 마디 방향으로 사분면 보정 */
function fenceDirectionOf(segment: Segment, slope: number): number {
  const direction = arctangentOfSlope(slope)
  const run = segment.x2 - segment.x1
  const fall = segment.z2 - segment.z1
  if (run < 0) return fall < 0 ? direction + 180 : 180 - direction
  return fall < 0 ? -direction : direction
}

/** 9fabc cur.x < 11480+500 → 3루 쪽 0xd7674 · cur.x > 28520−500 → 1루 쪽 0xd7660 · 그 사이 없음 */
function standOf(current: BallPoint): Segment | null {
  if (current.x < THIRD_BASE_STAND.x2 + STAND_MARGIN) return THIRD_BASE_STAND
  if (current.x > FIRST_BASE_STAND.x1 - STAND_MARGIN) return FIRST_BASE_STAND
  return null
}

/** 홈 둘레 파울 관중석 — 9fcec 높이 > 1999 → 관중석 위로 넘음(+0x2a) */
function standCollisionOf(previous: BallPoint, current: BallPoint, angle: number): CollisionResult {
  const stand = standOf(current)
  if (stand === null) return NO_COLLISION
  const crossing = crossingOf(stand, previous, current)
  if (crossing === null) return NO_COLLISION
  return {
    hit: true,
    x: crossing.x,
    y: crossing.y,
    z: crossing.z,
    angle: toShort(standAngleOf(stand, crossing, angle)),
    pole: false,
    overFence: false,
    overStand: crossing.y > WALL_FACE_HEIGHT,
  }
}

/** 9fca0 r6 = atan(m1) · r3 = atan((m2 − m1) + m1·m2) ← 원본 그대로(분모가 아니라 더한다) · a < 0 → (z2 > z1 ? r3 + a : a − r3) · a ≥ 0 → 180 − a */
function standAngleOf(stand: Segment, crossing: Crossing, angle: number): number {
  const newAngle = arctangentOfSlope(crossing.slope)
  const between = arctangentOfSlope((crossing.pathSlope - crossing.slope + multiply(crossing.slope, crossing.pathSlope)) | 0)
  const run = stand.x2 - stand.x1
  const fall = stand.z2 - stand.z1
  if (run === 0 || fall === 0) return newAngle
  if (angle >= 0) return 180 - angle
  return fall > 0 ? between + angle : angle - between
}
