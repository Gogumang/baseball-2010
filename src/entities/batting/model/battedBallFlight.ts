import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { BASE_POSITIONS, horizontalDistance, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { cosineHundred, sineHundred } from '@/shared/lib/math/originalTrigonometry'

/**
 * ============================================================================
 * ⚠️ 이 파일의 물리는 **근사다. 원본 타구 루프(0xb3b38 · 0xb401c)를 옮긴 것이 아니다.**
 * ============================================================================
 *
 * 원본은 타구 순간 공 객체에 궤적 점을 최대 130 개 미리 깔아 두고(+0x74 목록 · +0x6c 개수 ·
 * +0xaa0 낙구 틱 · +0xaa4 담장 틱 · +0xab0 폴 틱) 매 틱 한 점씩 재생한다. 그 점을 만드는
 * 물리 루프는 **이 저장소의 해독 금지 주제**다(`docs/re/D-pitch-trajectory.md` · DECISIONS).
 * 그래서 여기서는 루프를 뜯지 않고 **원본 데이터에서 읽을 수 있는 것만** 쓴다:
 *
 *   `data/pattern.dat` 한 항목 = [a 수평각, b 세기, c 높이, 플래그] (0xb0614).
 *   - a: 45 = 1루 쪽 파울선 · 90 = 가운데 · 135 = 3루 쪽 파울선
 *     (`hitDirection` 의 방향 1 = 92~135 가 우타자 당겨친 좌익 쪽이라 각이 클수록 3루 쪽이다)
 *   - b: 타구 세기 → **틱당 수평 이동량**으로 본다
 *   - c: 타구 높이 → **틱당 첫 수직 속도**로 본다. 플래그 비트0 이면 부호가 뒤집힌다(0xb0614) —
 *     곧 내리꽂는 타구가 된다. 버그처럼 보여도 원본 저장 규칙 그대로 옮긴다.
 *
 * 나머지(중력·반발·구르기 감속·담장 거리)는 **내가 정한 상수**다. 고른 기준은 아래 주석에 적었다.
 * 값은 "원본 코드에서 읽은 것" 이 아니므로, 나중에 물리 루프를 풀면 이 파일만 갈아 끼우면 된다.
 *
 * 좌표계는 `entities/fielding` 의 월드 40000×32500 을 그대로 쓴다 (x 클수록 1루 쪽, z 작을수록 외야).
 */

/**
 * 타구 시작점 (20000, 1000, 30000) — `catchPrediction.BattedBallTrajectory.startedAtPlate` 가
 * "표준 배팅 지점" 으로 보는 바로 그 점이다. 홈 루(20000, 29445)보다 조금 뒤(z 가 큼)다.
 */
export const BATTING_POINT: WorldPoint = { x: 20_000, y: 1_000, z: 30_000 }

/** 궤적 점 개수 상한 — 원본 공 +0x6c 의 최대 130 (P2 2a) */
export const MAXIMUM_TRAJECTORY_POINTS = 130

/**
 * 중력(틱² 당 낙하). **내가 정한 값.**
 * 고른 기준: 결과 코드 0(뜬공 묶음)의 대표 패턴 [90, 810, 1592] 이 외야수 자리(홈에서 ≈20000)
 * 근처에 떨어지고, 홈런 묶음(24~26) 중 `outcomeOfPattern` 이 홈런으로 치는 세기 1100 이상이
 * 아래 담장 거리를 넘도록 맞췄다.
 */
export const GRAVITY_PER_TICK = 130

/** 바운드 반발(%) — 수직 속도가 이만큼 남는다. 내가 정한 값 */
const RESTITUTION_PERCENT = 40
/** 바운드할 때 수평 속도가 남는 비율(%). 내가 정한 값 */
const BOUNCE_HORIZONTAL_PERCENT = 70
/** 구를 때 한 틱마다 남는 수평 속도 비율(%). 내가 정한 값 — 22 틱쯤이면 멈춘다 */
const ROLL_PERCENT = 82
/** 이보다 작은 반발 속도는 그냥 구르는 것으로 본다 */
const MINIMUM_BOUNCE_SPEED = 60

/**
 * 담장 거리 — 홈 루에서 이만큼 나가면 넘어간 것으로 본다. **내가 정한 값.**
 * 외야수 기본 자리가 홈에서 20200~21400 이라 그보다 한참 뒤인 26000 으로 두었다.
 * 파울선(45°·135°) 방향으로 26000 이면 x 가 38400 이라 월드 가로 40000 안에 들어온다.
 */
export const FENCE_DISTANCE = 26_000

/** 파울 기둥 — 수평각이 파울선과 정확히 같은 각(45·135)일 때만 폴 접촉으로 본다 (패턴 표에 그 각이 실제로 있다) */
const FOUL_POLE_ANGLES: readonly number[] = [45, 135]

export interface BattedBallFlightOptions {
  /** 시작점. 기본은 `BATTING_POINT` */
  readonly origin?: WorldPoint
  /** 중력. 기본은 `GRAVITY_PER_TICK` */
  readonly gravity?: number
  /** 점 개수 상한. 기본은 130 */
  readonly maximumPoints?: number
}

/**
 * 원본 패턴 한 장 → 궤적. 되돌려 주는 것은 `catchPrediction` 이 쓰는 `BattedBallTrajectory` 그대로다.
 *
 * 다시 적는다 — **여기 적분은 근사다**. 원본 점 목록을 재현한 것이 아니라
 * 패턴의 (각·세기·높이)만 원본에서 읽고 등가속 포물선 + 바운드 + 구르기로 이어 붙인 것이다.
 */
export function battedBallTrajectory(
  pattern: BattedBallPattern,
  options: BattedBallFlightOptions = {},
): BattedBallTrajectory {
  const [angle, speed, height, flags] = pattern
  const origin = options.origin ?? BATTING_POINT
  const gravity = options.gravity ?? GRAVITY_PER_TICK
  const limit = options.maximumPoints ?? MAXIMUM_TRAJECTORY_POINTS

  // 각 → 수평 방향. 45 → (+x, −z) 1루 쪽 파울선 · 90 → (0, −z) 가운데 · 135 → (−x, −z) 3루 쪽 파울선
  let vx = Math.trunc((speed * cosineHundred(angle)) / 100)
  let vz = -Math.trunc((speed * sineHundred(angle)) / 100)
  // 플래그 비트0 = 높이 부호 반전 (0xb0614). 내리꽂는 타구가 된다 — 원본 규칙 그대로
  let vy = (flags & 1) !== 0 ? -height : height

  const home = BASE_POSITIONS[0]
  const points: WorldPoint[] = [origin]
  let x = origin.x
  let y = origin.y
  let z = origin.z
  let rolling = false
  let landingTick = -1
  let fenceTick = -1

  for (let tick = 1; tick < limit; tick += 1) {
    if (rolling) {
      vx = Math.trunc((vx * ROLL_PERCENT) / 100)
      vz = Math.trunc((vz * ROLL_PERCENT) / 100)
      x += vx
      z += vz
      y = 0
    } else {
      vy -= gravity
      x += vx
      y += vy
      z += vz
      if (y <= 0) {
        y = 0
        if (landingTick < 0) landingTick = tick
        // 튕김 — 수직은 반발 비율만큼, 수평은 마찰로 줄어든다
        vy = Math.trunc((-vy * RESTITUTION_PERCENT) / 100)
        vx = Math.trunc((vx * BOUNCE_HORIZONTAL_PERCENT) / 100)
        vz = Math.trunc((vz * BOUNCE_HORIZONTAL_PERCENT) / 100)
        if (vy < MINIMUM_BOUNCE_SPEED) {
          vy = 0
          rolling = true
        }
      }
    }
    points.push({ x, y, z })

    // 담장에 닿으면 거기서 끝낸다 — 넘어간 공은 더 굴릴 데가 없고, 굴러간 공은 담장에 막힌다
    if (horizontalDistance(home, { x, y, z }) > FENCE_DISTANCE) {
      fenceTick = tick
      break
    }
    // 굴러서 멈추면 거기서 궤적이 끝난다 (원본도 점 목록이 유한하다)
    if (rolling && vx === 0 && vz === 0) break
  }

  const poleTick = FOUL_POLE_ANGLES.includes(angle) ? fenceTick : -1

  return {
    length: points.length,
    pointAt: (tick: number) => points[Math.max(0, Math.min(points.length - 1, Math.trunc(tick)))],
    landingTick: landingTick < 0 ? points.length - 1 : landingTick,
    fenceTick,
    poleTick,
    startedAtPlate:
      origin.x === BATTING_POINT.x && origin.y === BATTING_POINT.y && origin.z === BATTING_POINT.z,
  }
}

/** 궤적이 담장을 넘었는가 — `fenceTick` 이 −1 이 아니면 넘었다 */
export function clearedFence(trajectory: BattedBallTrajectory): boolean {
  return trajectory.fenceTick >= 0
}

/** 낙구 지점 (공 +0xaa0 의 점). 화면·수비가 "어디로 뛸까" 의 기준으로 쓴다 */
export function landingPointOf(trajectory: BattedBallTrajectory): WorldPoint {
  return trajectory.pointAt(trajectory.landingTick)
}

/** 홈에서 낙구 지점까지의 거리 — 타구가 얼마나 멀리 갔나 */
export function carryDistanceOf(trajectory: BattedBallTrajectory): number {
  return horizontalDistance(BASE_POSITIONS[0], landingPointOf(trajectory))
}
