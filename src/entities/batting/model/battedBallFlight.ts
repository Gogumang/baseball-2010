import {
  aimBall,
  BALL_LAUNCH_POINT,
  ballPointAt,
  cloneBallBody,
  createBallBody,
  isBallStoppedAt,
  launchBall,
  MAXIMUM_BALL_POINTS,
  placeBall,
  restoreGravity,
  scaleGravity,
  simulateBall,
  type BallBody,
  type BallFlight,
  type BallPoint,
} from '@/entities/batting/model/ballPhysics'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { BASE_POSITIONS, horizontalDistance, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * 원본 패턴 한 장 → 원본 공 궤적.
 *
 * 타구 순간(장면 메시지 0x11 → 0x50faa):
 * ```
 * 51058 공 = [장면+0x204] ; 0xbef58(공, 0xcfb70 = (20000, 1000, 30000))     위치 · 기준점 · 목표
 * 51090 패턴 덱 0xb0b01 → −a(각) · 0xb0ab9 → b(속도) · 0xb0a51 → ±c(높이, 0xb07b4 가 부호)
 * 51188 공.vt44 = 0xa2870(b, ±c, −a)                                       쏘기
 * 511a4 세계 [장면+0x1e4].vtC(공+0x58) = 0xbfed0                           점 미리 깔기 (`ballPhysics`)
 * 511ea state[0x20] = 공+0xaa4 · state[0x80] = 공+0xab0
 * ```
 * 물리 · 충돌 · 사건 틱은 전부 `ballPhysics` 에 직접 뜬 대로 옮겼다. 좌표계는 `entities/fielding` 의
 * 월드 40000×32500 그대로다 (x 클수록 1루 쪽, z 작을수록 외야, y 가 높이).
 */

/** 타구 시작점 (20000, 1000, 30000) — 0xcfb70 · 0xd7bdc */
export const BATTING_POINT: WorldPoint = BALL_LAUNCH_POINT

/** 궤적 점 개수 상한 — 원본 공 +0x6c 의 최대 130 (0xa29c2) */
export const MAXIMUM_TRAJECTORY_POINTS = MAXIMUM_BALL_POINTS

/** 원본 물리가 깐 궤적 — 화면·수비가 쓰는 `BattedBallTrajectory` 에 원본 칸을 더 들고 있다 */
export interface BallTrajectory extends BattedBallTrajectory {
  readonly wallTick: number
  readonly carryScale: number
  /** 공 +0xac4 — 깊은 페어 타구 */
  readonly deepHit: boolean
  pointDetailAt(tick: number): BallPoint
  isStoppedAt(tick: number): boolean
  /** 미리 계산 결과 그대로 */
  readonly flight: BallFlight
  /** 쏘기 직전의 공 — 난수를 주고 다시 계산할 때(`trajectoryWithRandom`) 여기서 다시 돈다 */
  readonly launchBody: BallBody
}

export interface BattedBallFlightOptions {
  /** 시작점. 기본은 `BATTING_POINT` */
  readonly origin?: WorldPoint
  /**
   * 난수 — 폴 충돌(0xa2c64 rand(−25, 25))이 있을 때만 쓴다. 안 주면 그 굴림을 0 으로 둔다
   * (`flight.randomRolls` 가 굴림 수를 알려 준다 — 난수를 가진 쪽이 `trajectoryWithRandom` 으로 다시 돈다).
   */
  readonly random?: RandomPort
  /**
   * 이어 받을 공 객체 칸 — 원본 공은 한 경기 내내 같은 객체라 지난 계산이 남긴 칸(땅 위 · 멈춤 표시 등)을
   * 다음 발사가 이어 받는다. 안 주면 갓 만든 공(0xa26e4)이다.
   */
  readonly body?: BallBody
}

/** 공을 놓고 쏜 뒤 세계 0xbfed0 을 돌린다 — 타구 · 펌블(0xb32e8) · 튕김(0xb3148) 이 모두 이 순서다 */
export function launchTrajectory(input: {
  readonly from: WorldPoint
  readonly speed: number
  readonly verticalSpeed: number
  /** 원본 각(도) — 패턴 각의 부호를 뒤집은 것 */
  readonly angle: number
  readonly random?: RandomPort
  readonly body?: BallBody
}): BallTrajectory {
  const body = input.body === undefined ? createBallBody() : cloneBallBody(input.body)
  placeBall(body, input.from)
  launchBall(body, input.speed, input.verticalSpeed, input.angle)
  const launchBody = cloneBallBody(body)
  return trajectoryOf(simulateBall(body, input.random), launchBody, input.from)
}

/**
 * **송구 공을 세계로 다시 깐다** — 던지기 0xa1620 의 끝(a19d6~a1a20) 뒤 0xb2e38 이 메시지 0x12(b2f8c → 0x51f2e)로
 * 같은 공([장면+0x204] = 야수+0xd0)에 세계 0xbfed0 을 돌린다 (직접 뜬 것):
 * ```
 * a1640  놓는 점 = (야수 x, 1000, 야수 z) · a16d0 받는 점 = (점 x, 1000, 점 z)
 * a1708  0xa279c(공, 칸 ≤ 5 ? 70 : 80) — 중력 배율, 마무리 0xa2a88(a2b14)이 되돌린다
 * a19f2  0xbef58(공, 놓는 점) · a1a10 공.vt14(받는 점) = 0xbf2cc · a1a20 공.vt44(h, w, φ)
 * ```
 * 악송구(a1908 → 공+0xaac = 1)는 b2f9c 의 받는 점 끼워 넣기(점[T−1] = 받는 점)를 건너뛰어 이 궤적 그대로 굴러간다.
 */
export function thrownBallTrajectory(input: {
  readonly from: WorldPoint
  readonly target: WorldPoint
  readonly speed: number
  readonly verticalSpeed: number
  readonly angle: number
  /** 중력 배율 % — 칸 ≤ 5 면 70, 아니면 80 */
  readonly gravityPercent: number
  readonly random?: RandomPort
  readonly body?: BallBody
}): BallTrajectory {
  const body = input.body === undefined ? createBallBody() : cloneBallBody(input.body)
  const from = { x: input.from.x, y: THROW_HEIGHT, z: input.from.z }
  placeBall(body, from)
  const saved = scaleGravity(body, input.gravityPercent)
  aimBall(body, { x: input.target.x, y: THROW_HEIGHT, z: input.target.z })
  launchBall(body, input.speed, input.verticalSpeed, input.angle)
  const launchBody = cloneBallBody(body)
  const flight = simulateBall(body, input.random)
  restoreGravity(flight.body, saved)
  return trajectoryOf(flight, launchBody, from)
}

/** 송구 공을 놓고 받는 높이 — 0xa1640 · 0xa16d0 `movs #0xfa ; lsls #2` */
const THROW_HEIGHT = 1_000

function trajectoryOf(flight: BallFlight, launchBody: BallBody, from: WorldPoint): BallTrajectory {
  const { points, events, body } = flight
  return {
    length: points.length,
    pointAt: (tick: number) => {
      const point = ballPointAt(points, tick)
      return { x: point.x, y: point.y, z: point.z }
    },
    pointDetailAt: (tick: number) => ballPointAt(points, tick),
    isStoppedAt: (tick: number) => isBallStoppedAt(points, tick, body),
    landingTick: events.landingTick,
    fenceTick: events.fenceTick,
    wallTick: events.wallTick,
    poleTick: events.poleTick,
    carryScale: events.carryScale,
    deepHit: events.deepHit,
    startedAtPlate: from.x === BATTING_POINT.x && from.y === BATTING_POINT.y && from.z === BATTING_POINT.z,
    flight,
    launchBody,
  }
}

/** 원본 패턴 [a, b, c, 플래그] → 궤적. 플래그 비트0 이면 높이 부호를 뒤집는다 (0xb07b4) */
export function battedBallTrajectory(
  pattern: BattedBallPattern,
  options: BattedBallFlightOptions = {},
): BallTrajectory {
  const [angle, speed, height, flags] = pattern
  const trajectory = launchTrajectory({
    from: options.origin ?? BATTING_POINT,
    speed,
    verticalSpeed: (flags & 1) !== 0 ? -height : height,
    angle: -angle,
    random: options.random,
    body: options.body,
  })
  // 0x514e6 — 패턴 플래그 비트 1 이면 플레이 +0x127 (0xb07c8 = `lsls #0x1e` 로 비트 1 을 본다)
  return (flags & LANDING_CHASE_FLAG) !== 0 ? { ...trajectory, landingChase: true } : trajectory
}

/** 패턴 플래그 비트 1 — 플레이 +0x127 (0xb07c8 · 0x514e6) */
const LANDING_CHASE_FLAG = 2

/** 원본 칸을 다 든 궤적인가 — 손으로 만든 시험 궤적이면 거짓 */
export function isBallTrajectory(trajectory: BattedBallTrajectory): trajectory is BallTrajectory {
  return 'flight' in trajectory && 'launchBody' in trajectory
}

/**
 * 난수를 받아 폴 충돌 굴림까지 원본대로 다시 깐다. 굴림이 없던 궤적은 **그대로 돌려준다**(난수를 안 쓴다).
 * 원본 굴림 자리는 쏜 순간(메시지 0x11 · 0x12) 세계 0xbfed0 안이다.
 */
export function trajectoryWithRandom(
  trajectory: BattedBallTrajectory,
  random: RandomPort | undefined,
): BattedBallTrajectory {
  if (random === undefined || !isBallTrajectory(trajectory)) return trajectory
  if (trajectory.flight.randomRolls === 0) return trajectory
  const body = cloneBallBody(trajectory.launchBody)
  const from = { x: body.x, y: body.y, z: body.z }
  const relaid = trajectoryOf(simulateBall(body, random), cloneBallBody(trajectory.launchBody), from)
  // +0x127 은 공이 아니라 플레이 칸 — 다시 깔아도 그대로
  return trajectory.landingChase === true ? { ...relaid, landingChase: true } : relaid
}

/**
 * 판 도중 다시 쏜 공을 앞 궤적 뒤에 잇는다 — 펌블·필살타법 타구가 야수에게 맞고 튕기는 0xb3148 처럼.
 * 다시 쏘면 공+0x68 이 0 으로 돌아가고(예보 b12da 의 0xa25ad(공, 0)) 재생이 그 틱부터 다시 센다. 진행기는 판 틱으로
 * 점을 읽으므로 `atTick` 부터는 새 궤적의 0 번 점이다.
 * - 사건 틱 aa4 · ab0 · aa8 은 새 궤적의 것(state[0x20] · [0x80] 은 0xb3148 b3282 · b328a 가 새 값으로 다시 적는다)
 * - 낙구 aa0 은 앞 궤적이 이미 땅에 닿았으면 그 틱 그대로(state[0x1e] · +0x112 는 한 번 서면 판 끝까지 남는다), 아니면 새 궤적의 것
 */
export function spliceTrajectory(
  base: BattedBallTrajectory,
  atTick: number,
  next: BallTrajectory,
): BallTrajectory {
  const shift = (tick: number) => (tick < 0 ? -1 : tick + atTick)
  const landedBefore = base.landingTick >= 0 && base.landingTick < atTick
  return {
    length: atTick + next.length,
    pointAt: (tick: number) => (tick < atTick ? base.pointAt(tick) : next.pointAt(tick - atTick)),
    pointDetailAt: (tick: number) => {
      if (tick >= atTick) return next.pointDetailAt(tick - atTick)
      const point = base.pointAt(tick)
      return { ...point, speed: 0, verticalSpeed: 0, angle: 0, bounceMark: 0, ...base.pointDetailAt?.(tick) }
    },
    isStoppedAt: (tick: number) =>
      tick < atTick ? base.isStoppedAt?.(tick) === true : next.isStoppedAt(tick - atTick),
    landingTick: landedBefore ? base.landingTick : shift(next.landingTick),
    fenceTick: shift(next.fenceTick),
    wallTick: shift(next.wallTick),
    poleTick: shift(next.poleTick),
    carryScale: next.carryScale,
    deepHit: next.deepHit,
    startedAtPlate: false,
    flight: next.flight,
    launchBody: next.launchBody,
    // 플레이 +0x127 — 다시 쏘기(0xb3148)는 안 건드린다
    landingChase: base.landingChase,
  }
}

/** 궤적이 담장(또는 파울 관중석) 위로 넘었는가 — 공 +0xaa4 */
export function clearedFence(trajectory: BattedBallTrajectory): boolean {
  return trajectory.fenceTick >= 0
}

/** 낙구 지점 (공 +0xaa0 의 점 — 없으면 0xa2b78 이 자르는 대로 점 0). 화면·수비가 "어디로 뛸까" 의 기준으로 쓴다 */
export function landingPointOf(trajectory: BattedBallTrajectory): WorldPoint {
  return trajectory.pointAt(trajectory.landingTick)
}

/** 홈에서 낙구 지점까지의 거리 — 타구가 얼마나 멀리 갔나 */
export function carryDistanceOf(trajectory: BattedBallTrajectory): number {
  return horizontalDistance(BASE_POSITIONS[0], landingPointOf(trajectory))
}
