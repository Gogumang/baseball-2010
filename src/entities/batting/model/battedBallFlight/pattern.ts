import { cloneBallBody, simulateBall } from '@/entities/batting/model/ballPhysics'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import {
  BATTING_POINT,
  launchTrajectory,
  trajectoryOf,
  type BallTrajectory,
  type BattedBallFlightOptions,
} from '@/entities/batting/model/battedBallFlight/launch'
import type { BattedBallTrajectory } from '@/entities/batting/model/battedBallFlight/otherSlices'

/** 원본 패턴 [a, b, c, 플래그] → 궤적. 플래그 비트0 이면 높이 부호를 뒤집는다 (0xb07b4) */
export function battedBallTrajectory(pattern: BattedBallPattern, options: BattedBallFlightOptions = {}): BallTrajectory {
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
export function trajectoryWithRandom(trajectory: BattedBallTrajectory, random: RandomPort | undefined): BattedBallTrajectory {
  if (random === undefined || !isBallTrajectory(trajectory)) return trajectory
  if (trajectory.flight.randomRolls === 0) return trajectory
  const body = cloneBallBody(trajectory.launchBody)
  const from = { x: body.x, y: body.y, z: body.z }
  const relaid = trajectoryOf(simulateBall(body, random), cloneBallBody(trajectory.launchBody), from)
  // +0x127 은 공이 아니라 플레이 칸 — 다시 깔아도 그대로
  return trajectory.landingChase === true ? { ...relaid, landingChase: true } : relaid
}
