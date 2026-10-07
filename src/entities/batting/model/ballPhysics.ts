import { horizontalDistance, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BATTED_BALL_PHYSICS } from '@/shared/config/original/battedBallPatterns'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { cosineSixteen, integerSquareRoot, sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import { TANGENT_TABLE } from '@/shared/config/original/trigonometryTables'

/**
 * ============================================================================
 * 원본 공 객체(vtable 0xd7afc)의 **궤적 미리 계산** — 직접 뜬 것 (사용자 허락으로 해석, 2026-10-07)
 * ============================================================================
 *
 * 타구 순간 원본은 공을 쏘고(vt44 = 0xa2870) 곧바로 장면 메시지 0x11(펌블·튕김은 0x12, 0x51f2e) 로
 * **물리 세계 0xbfed0(세계 vtable 0xd8eb0 의 0xc)** 를 돌려 점을 최대 130 개 미리 깐다. 화면·수비는
 * 그 점을 틱마다 재생만 한다(공+0x68). 여기는 그 미리 계산을 한 줄씩 옮긴 것이다.
 *
 * ## 세계 0xbfed0 (iface = 공+0x58, 보조 vtable 0xd7b74)
 * ```
 * bfee0 iface.vt8  = 0xa2974  사건 틱 초기화(0xa2610: +0x6c = +0x68 = −1, 점 칸 memset · aa0 aa4 aa8 ab0 = −1 · a9c = 0 · ac0 = 0)
 * bfeec iface.vtC(0) = 0xa29bc 점 0 기록 ; i = 1
 * bffe8 while !iface.vt28 (= 공 vt18 0xa27f0 멈춤):
 * bff3c   iface.vt24 = 공 vtC 0xbf094   한 틱 (아래)
 * bff46   iface.vtC(i)                  점 i 기록 — i > 129 면 0 → 끝
 * bff58   장애물 목록(세계+0x14, 장면 초기화 0x3e61c 가 0x9f750 하나만 넣는다)마다 hit 가 없을 동안:
 *           prev = iface.vt14(점 +0x68−1) · cur = iface.vt18(점 +0x68) · r = 장애물.vt8(prev, cur) = 0x9f7e8
 * bfef8     r.+0x26 → iface.vt20(i, r) = 0xa2bf0 충돌 통지 · iface.vtC(i) 다시 기록
 * bffe2   i++
 * bfff8 iface.vt10(i) = 0xa2a88 마무리
 * ```
 * ## 한 틱 0xbf094 (공 vtC)
 * ```
 * +0x50(얼림) → 아무것도 안 함 ; +0x3b = +0x39 = 0
 * 멈춤(vt18) 아니면: vt30 = 0xbf0dc · vt28 = 0xbf240 ; vt2c = 0xbf2ac(빈 함수)
 * 0xbf0dc  +0x3b = 0 ; (+0x3a && !멈춤) || +0x54 → +0x54 = +0x3a = 0 · vt34 = 0xbf330(+0x48 = 0xbee24 · t = 0)
 *          vt24 = 0xa28c0 비행 ; old = +0x3a ; +0x3a = 멈춤 ; 새로 멈췄으면 +0x3b = 1 · vt38(빈 함수)
 * 0xbee24  +0x48 = g > 0 ? isqrt(v0² + 2·y·g) − v0 + |v0| : 0
 * 0xa28c0  x += cos16(각)·속도 >> 16 · z += sin16(각)·속도 >> 16 · t++ · y = max(y0 + v0·t − (g·t·t >> 1), 0) · a9c = 0
 * 0xbf240  +0x39 = 0 ; y > 0 → +0x38 = 0
 *          y ≤ 0 → y = 0 · 기준점(+0x14) = 위치 · +0x53 ? (v0 = +0x48 · t = 0) : v0 = 0 · 땅에 처음이면 +0x39 = +0x38 = 1
 *          +0x38 && +0x53 → vt3c = 0xa292c
 * 0xa292c  +0x39 → +0x48 = v0 = +0x48·[+8]/100 · 속도 = 속도·[+4]/100
 *          아니면 0xbf348: v0 ≠ 0 → (위와 같고 +0x51 = 0) / v0 == 0 → +0x48 = v0 = +0x48·[+0x10]/100 · 속도 = 속도·[+0xc]/100
 * ```
 * [+4]·[+8]·[+0xc]·[+0x10]·g 는 장면 초기화 0x3edd0 이 pattern.dat 머리 바이트 4~8 에서 싣는다(기반 생성자 0xbec84 의 기본값과 같다).
 *
 * ## 점 기록 0xa29bc · 멈춤 0xa27f0 · 마무리 0xa2a88
 * ```
 * a29c2 i > 0x81 → 0 ; +0x6c = i+1 · +0x68 = i · 점 = (x, y, z, s16 속도, s16 v0, s16 각, u8 a9c)
 * a29f4 점.y ≤ 0 && aa0 == −1 && i > 0 → aa0 = i ; 각 ∈ [−135, −45] 이고 점이 홈(20000,0,29445)에서 10274 넘게 → ac4 = 1
 * a27f0 지금 점(+0x68)의 속도·v0 워드 == 0 && (y == 0 || 위치 == 목표 +0x2c) → 멈춤
 * a2a88 +0x68 = −1 · +0x6c = min(n, 130) ; aa4 ≠ −1 && aa0 ≠ −1 && 각 ∈ [−135, −45] → ac0 = min(|점(aa0) − (20000,1000,30000)| / 265, 160)
 * ```
 * 충돌 0x9f7e8 · 통지 0xa2bf0 은 `collideWithStadium` · `applyCollision` 주석에 있다.
 */

/** 점 하나 (0xa29bc 가 적는 20바이트) */
export interface BallPoint extends WorldPoint {
  /** +0xc 수평 속도 (s16) */
  readonly speed: number
  /** +0xe 수직 속도 v0 (s16) */
  readonly verticalSpeed: number
  /** +0x10 각 (s16, 도). 원본 각은 패턴 각의 부호를 뒤집은 것이다 — −90 이 가운데, −45 가 1루 쪽 파울선 */
  readonly angle: number
  /** +0x12 바운드 표시 a9c — 이 점에서 담장·폴에 맞고 꺾였다 */
  readonly bounceMark: number
}

/** 미리 계산이 끝난 공의 사건 틱 (모두 −1 로 시작) */
export interface BallEvents {
  /** +0xaa0 — 처음으로 높이 ≤ 0 이 된 점 */
  readonly landingTick: number
  /** +0xaa4 — 담장(또는 파울 쪽 관중석) **위로** 넘는 충돌 */
  readonly fenceTick: number
  /** +0xaa8 — 높이 ≤ 1999 에서 담장 면에 맞고 꺾인 충돌 */
  readonly wallTick: number
  /** +0xab0 — 파울 폴(각이 꼭 −45 · −135 일 때 1999 < 높이 ≤ 7000)에 맞은 충돌 */
  readonly poleTick: number
  /** +0xac0 — 담장을 넘은 페어 타구의 낙구 거리 눈금 0~160 (그 밖 0) */
  readonly carryScale: number
  /** +0xac4 — 낙구점이 홈에서 10274 넘게 떨어진 페어 타구 */
  readonly deepHit: boolean
}

/** 공 객체의 물리 칸 — 미리 계산이 끝난 뒤의 값을 다음 발사(펌블 0xb32e8 · 튕김 0xb3148)가 이어 받는다 */
export interface BallBody {
  /** +0x20 위치 */
  x: number
  y: number
  z: number
  /** +0x14 기준점 — +0x18 이 y0 */
  originX: number
  originY: number
  originZ: number
  /** +0x2c 목표 (위치를 놓을 때 0xbf2cc 가 바꾼다) */
  targetX: number
  targetY: number
  targetZ: number
  /** +0x3c 수평 속도 */
  speed: number
  /** +0x40 수직 속도 v0 */
  verticalSpeed: number
  /** +0x44 중력 */
  gravity: number
  /** +0x48 다음 바운드 속도 */
  bounceSpeed: number
  /** +0x4c 비행 틱 */
  flightTick: number
  /** +0x70 각 */
  angle: number
  /** +4 · +8 · +0xc · +0x10 — 바운드 수평 · 바운드 수직 · 구르기 · 멈춘 공 수직 (%) */
  bounceHorizontalPercent: number
  bounceVerticalPercent: number
  rollPercent: number
  restVerticalPercent: number
  /** +0x38 땅 위 · +0x39 이번 틱 착지 · +0x3a 멈춤 · +0x3b 이번 틱 멈춤 */
  onGround: boolean
  landedThisTick: boolean
  stopped: boolean
  stoppedThisTick: boolean
  /** +0x50 얼림 · +0x51 · +0x52 · +0x53 바운드 켬 · +0x54 다시 쏨 */
  frozen: boolean
  flag51: boolean
  flag52: boolean
  bounces: boolean
  relaunched: boolean
  /** +0xa9c 바운드 표시 */
  bounceMark: number
}

/** 미리 계산 결과 */
export interface BallFlight {
  readonly points: readonly BallPoint[]
  readonly events: BallEvents
  /** 이 계산에서 돈 rand 굴림 수 (폴 충돌 0xa2c64 의 rand(−25, 25)) */
  readonly randomRolls: number
  /** 계산이 끝난 공 — 다음 발사가 이 칸들을 이어 받는다 */
  readonly body: BallBody
}

/** 점 개수 상한 — 0xa29c2 `cmp r1, #0x81` */
export const MAXIMUM_BALL_POINTS = 130

/** 0xd7bdc — 타구 시작점이자 ac0 거리의 기준 */
export const BALL_LAUNCH_POINT: WorldPoint = { x: 20_000, y: 1_000, z: 30_000 }
/** 0xd7be8 — ac4 거리의 기준(홈) */
const DEEP_HIT_ORIGIN: WorldPoint = { x: 20_000, y: 0, z: 29_445 }
/** a2a52 0x2822 */
const DEEP_HIT_DISTANCE = 10_274
/** a2b02 0x109 · a2b0c 0xa0 */
const CARRY_SCALE_DIVISOR = 265
const CARRY_SCALE_MAXIMUM = 160
/** 담장 면 충돌로 보는 높이 상한 (9fa4a · a2cb0 의 0x7cf) */
export const WALL_FACE_HEIGHT = 1_999
/** 폴에 맞는 높이 상한 (9fa5a 0x1b58) */
const POLE_HEIGHT = 7_000
/** 수직 선의 기울기 표시 (9f8b2 `0x80 << 0x17`) */
const VERTICAL_SLOPE = 0x4000_0000

// ── 원본 정수 연산 ──────────────────────────────────────────────────────

/** 0xca7b4 — 부호 있는 나눗셈(0 쪽으로 버림), 0 으로 나누면 0 (0xca83c) */
export function divide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  const quotient = Math.floor(Math.abs(numerator) / Math.abs(denominator))
  return ((numerator < 0) !== (denominator < 0) ? -quotient : quotient) | 0
}

const multiply = Math.imul

/** 0x6c758 → 0x6c71c — tan × 10000 표 이진 탐색(절댓값). 곱은 32비트로 감긴다 */
function arctangentOfSlope(slope: number): number {
  let value = multiply(slope, 100)
  if (value < 0) value = -value | 0
  let low = 0
  let high = 89
  let previous = -1
  for (;;) {
    const middle = (low + high) >> 1
    if (middle === previous) return middle
    previous = middle
    if (value < TANGENT_TABLE[middle]) high = middle
    else low = middle
  }
}

/** s16 로 자른다 (strh) */
const toShort = (value: number) => (value << 16) >> 16

/** 0x9f8ae · 0x9fb10 — 두 점의 기울기 ×100 (x 가 같으면 0x40000000) */
function slopeOf(fromX: number, fromZ: number, toX: number, toZ: number): number {
  if (fromX === toX) return VERTICAL_SLOPE
  return divide(multiply(toZ - fromZ, 100), toX - fromX)
}

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

// ── 한 틱 ───────────────────────────────────────────────────────────────

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
function bounce(body: BallBody): void {
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
  if (body.y > 0) {
    body.onGround = false
  } else {
    body.y = 0
    body.originX = body.x
    body.originY = 0
    body.originZ = body.z
    if (body.bounces) {
      body.verticalSpeed = body.bounceSpeed
      body.flightTick = 0
    } else {
      body.verticalSpeed = 0
    }
    if (!body.onGround) {
      body.landedThisTick = true
      body.onGround = true
    }
  }
  if (body.onGround && body.bounces) bounce(body)
}

/** 0xa27f0 — 지금 점의 속도 워드가 0 이고 (높이 0 이거나 목표에 섰다) */
function isStoppedPoint(body: BallBody, point: BallPoint | undefined): boolean {
  if (point === undefined) return false
  if ((point.speed & 0xffff) !== 0 || (point.verticalSpeed & 0xffff) !== 0) return false
  if (body.y === 0) return true
  return body.x === body.targetX && body.y === body.targetY && body.z === body.targetZ
}

/** 0xbf094 (공 vtC) */
function step(body: BallBody, current: BallPoint | undefined): void {
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

// ── 충돌 0x9f7e8 ─────────────────────────────────────────────────────────

/** 0x9f7e8 이 돌려주는 0x2c 바이트 구조체 (S7 6-2) */
export interface CollisionResult {
  /** +0x26 */
  readonly hit: boolean
  /** +0x00 · +0x04 · +0x08 */
  readonly x: number
  readonly y: number
  readonly z: number
  /** +0x24 */
  readonly angle: number
  /** +0x28 폴(각 −45 · −135, 1999 < 높이 ≤ 7000) */
  readonly pole: boolean
  /** +0x29 담장 위로 넘음 (높이 > 1999) */
  readonly overFence: boolean
  /** +0x2a 홈 둘레 파울 쪽 관중석 위로 넘음 (높이 > 1999) */
  readonly overStand: boolean
}

interface Segment {
  readonly x1: number
  readonly z1: number
  readonly x2: number
  readonly z2: number
}

/** 0xd7688 — 외야 담장 일곱 마디 (다섯째 워드 200 은 읽는 곳이 없다) */
export const OUTFIELD_FENCE: readonly Segment[] = [
  { x1: 0, z1: 11_440, x2: 1_935, z2: 8_905 },
  { x1: 1_935, z1: 8_905, x2: 8_772, z2: 4_160 },
  { x1: 8_772, z1: 4_160, x2: 13_158, z2: 1_820 },
  { x1: 13_158, z1: 1_820, x2: 26_832, z2: 1_820 },
  { x1: 26_832, z1: 1_820, x2: 31_218, z2: 4_160 },
  { x1: 31_218, z1: 4_160, x2: 38_055, z2: 8_905 },
  { x1: 38_055, z1: 8_905, x2: 40_000, z2: 11_440 },
]
/** 0xd7674 — 3루 쪽 파울 관중석 벽 (다섯째 워드 100) */
export const THIRD_BASE_STAND: Segment = { x1: 0, z1: 13_095, x2: 11_480, z2: 32_500 }
/** 0xd7660 — 1루 쪽 파울 관중석 벽 */
export const FIRST_BASE_STAND: Segment = { x1: 28_520, z1: 32_500, x2: 40_000, z2: 13_095 }

const NO_COLLISION: CollisionResult = {
  hit: false,
  x: 0,
  y: 0,
  z: 0,
  angle: 0,
  pole: false,
  overFence: false,
  overStand: false,
}

const signOf = (value: number) => (value > 0 ? 1 : value < 0 ? -1 : 0)

interface Crossing {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly slope: number
  readonly pathSlope: number
}

/**
 * 직선 마디와 prev→cur 선분의 교차 (9f8a6~9fa12 · 9fb08~9fc96 — 두 갈래가 같은 식).
 * 마디는 **무한 직선**으로 본다(양 끝 x 범위는 부르는 쪽이 따로 거른다).
 */
function crossingOf(segment: Segment, previous: BallPoint, current: BallPoint): Crossing | null {
  const slope = slopeOf(segment.x1, segment.z1, segment.x2, segment.z2)
  const vertical = previous.x === current.x
  const pathSlope = vertical ? VERTICAL_SLOPE : divide(multiply(current.z - previous.z, 100), current.x - previous.x)
  if (slope === pathSlope) return null
  const previousSide = divide(multiply(previous.x - segment.x1, slope), 100) + segment.z1 - previous.z
  const currentSide = divide(multiply(current.x - segment.x1, slope), 100) + segment.z1 - current.z
  if (signOf(previousSide) === signOf(currentSide)) return null
  // 9f97a — 32비트 정수로 감기는 그대로 (기울기가 크면 곱이 넘친다)
  const numerator =
    ((((multiply(segment.x1, slope) - multiply(segment.z1, 100)) | 0) - multiply(current.x, pathSlope)) | 0) +
    multiply(current.z, 100)
  const x = vertical ? current.x : divide(numerator | 0, (slope - pathSlope) | 0)
  const z = divide(multiply(x - segment.x1, slope), 100) + segment.z1
  const dx = current.x - previous.x
  const dz = current.z - previous.z
  const rise = current.y - previous.y
  const y =
    previous.y +
    (Math.abs(dx) > Math.abs(dz)
      ? divide(multiply(x - previous.x, rise), dx)
      : divide(multiply(z - previous.z, rise), dz))
  return { x, y, z, slope, pathSlope }
}

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
  if (((angle + 180) & 0xffff) <= 180) {
    const [from, to] = angle + 90 >= 0 ? [3, 7] : [0, 4]
    for (let index = from; index < to; index += 1) {
      const segment = OUTFIELD_FENCE[index]
      if (index !== 0 && index !== 6) {
        const previousInside = previous.x >= segment.x1 && previous.x <= segment.x2
        const currentInside = current.x >= segment.x1 && current.x <= segment.x2
        if (!previousInside && !currentInside) continue
      }
      const crossing = crossingOf(segment, previous, current)
      if (crossing === null) continue
      let direction = arctangentOfSlope(crossing.slope)
      const run = segment.x2 - segment.x1
      const fall = segment.z2 - segment.z1
      if (run < 0) direction = fall < 0 ? direction + 180 : 180 - direction
      else if (fall < 0) direction = -direction
      const newAngle = direction * 2 - angle
      let height = crossing.y
      let pole = false
      let overFence = false
      if (height > WALL_FACE_HEIGHT) {
        if ((angle === -45 || angle === -135) && height <= POLE_HEIGHT) {
          pole = true
          height = Math.trunc((current.y + previous.y) / 2)
        }
        overFence = !pole
      }
      return {
        hit: true,
        x: crossing.x,
        y: height,
        z: crossing.z,
        angle: toShort(newAngle),
        pole,
        overFence,
        overStand: false,
      }
    }
  }

  // ── 2. 파울 관중석 ──
  let stand: Segment
  if (current.x < THIRD_BASE_STAND.x2 + 500) stand = THIRD_BASE_STAND
  else if (current.x > FIRST_BASE_STAND.x1 - 500) stand = FIRST_BASE_STAND
  else return NO_COLLISION
  const crossing = crossingOf(stand, previous, current)
  if (crossing === null) return NO_COLLISION
  let newAngle = arctangentOfSlope(crossing.slope)
  const between = arctangentOfSlope(
    (crossing.pathSlope - crossing.slope + multiply(crossing.slope, crossing.pathSlope)) | 0,
  )
  const run = stand.x2 - stand.x1
  const fall = stand.z2 - stand.z1
  if (run !== 0 && fall !== 0) {
    if (fall > 0) newAngle = angle < 0 ? between + angle : 180 - angle
    else newAngle = angle < 0 ? angle - between : 180 - angle
  }
  return {
    hit: true,
    x: crossing.x,
    y: crossing.y,
    z: crossing.z,
    angle: toShort(newAngle),
    pole: false,
    overFence: false,
    overStand: crossing.y > WALL_FACE_HEIGHT,
  }
}

// ── 충돌 통지 0xa2bf0 ────────────────────────────────────────────────────

interface MutableEvents {
  landingTick: number
  fenceTick: number
  wallTick: number
  poleTick: number
  carryScale: number
  deepHit: boolean
}

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
function applyCollision(
  body: BallBody,
  events: MutableEvents,
  tick: number,
  result: CollisionResult,
  random: RandomPort | undefined,
  rolls: { count: number },
): void {
  if (!result.hit) return
  if (result.overStand) {
    if (events.fenceTick === -1) events.fenceTick = tick
    return
  }
  if (result.overFence) {
    if (events.fenceTick === -1) events.fenceTick = tick
    events.carryScale = 0
    return
  }
  if (result.pole) {
    if (events.poleTick === -1) events.poleTick = tick
    // 0xbfa54 rand(−25, 25). 난수를 안 주면 굴리지 않고 0 으로 둔다(웹 규약 — `trajectoryWithRandom` 이 다시 돈다)
    rolls.count += 1
    const offset = random === undefined ? 0 : randomIntegerBelow(random, -25, 25)
    body.angle = result.angle + offset
    body.x = result.x
    body.y = result.y
    body.z = result.z
    body.bounceMark = 1
    body.bounceSpeed = body.verticalSpeed
    body.speed >>= 1
    body.flag51 = false
    if (events.poleTick < events.landingTick) body.flag52 = true
    return
  }
  if (result.y > WALL_FACE_HEIGHT) return
  if (events.wallTick === -1) events.wallTick = tick
  body.angle = result.angle
  body.x = result.x
  body.z = result.z
  body.bounceMark = 1
  body.verticalSpeed = divide(multiply(body.verticalSpeed, 170), 100)
  body.bounceSpeed = body.verticalSpeed
  body.speed >>= 1
  body.flag51 = true
  bounce(body)
}

// ── 세계 0xbfed0 ─────────────────────────────────────────────────────────

/** 0xa29bc — 점을 적고 낙구 · ac4 를 본다. i > 129 면 거짓 */
function recordPoint(
  body: BallBody,
  points: BallPoint[],
  events: MutableEvents,
  index: number,
): boolean {
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
  if (point.y <= 0 && events.landingTick === -1 && index > 0) {
    events.landingTick = index
    if (((body.angle + 135) >>> 0) <= 90) {
      if (horizontalDistance(DEEP_HIT_ORIGIN, point) > DEEP_HIT_DISTANCE) events.deepHit = true
    }
  }
  return true
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
  const rolls = { count: 0 }
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
  if (events.fenceTick !== -1 && events.landingTick !== -1 && ((body.angle + 135) >>> 0) <= 90) {
    const landing = points[Math.min(events.landingTick, points.length - 1)]
    events.carryScale = Math.min(
      divide(horizontalDistance(BALL_LAUNCH_POINT, landing), CARRY_SCALE_DIVISOR),
      CARRY_SCALE_MAXIMUM,
    )
  }
  return { points, events, randomRolls: rolls.count, body }
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
