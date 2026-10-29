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
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { BattedBallTrajectory, WorldPoint } from '@/entities/batting/model/battedBallFlight/otherSlices'

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

/** 공을 놓고 쏜 뒤 세계 0xbfed0 을 돌린다 — 타구 · 펌블 · 튕김(둘 다 0xb3148 — vt78 0xb32e8 은 부르는 곳이 없다, U-101) 이 모두 이 순서다 */
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

export function trajectoryOf(flight: BallFlight, launchBody: BallBody, from: WorldPoint): BallTrajectory {
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
