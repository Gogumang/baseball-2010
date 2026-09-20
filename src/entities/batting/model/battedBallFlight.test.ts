import { describe, expect, it } from 'vitest'
import {
  BATTING_POINT,
  battedBallTrajectory,
  carryDistanceOf,
  clearedFence,
  FENCE_DISTANCE,
  landingPointOf,
  MAXIMUM_TRAJECTORY_POINTS,
} from '@/entities/batting/model/battedBallFlight'
import { BASE_POSITIONS, horizontalDistance } from '@/entities/fielding/model/fieldGeometry'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'

/** 원본 패턴 표에서 그대로 꺼낸 항목들 — 값을 지어내지 않는다 */
const 깊은뜬공 = BATTED_BALL_PATTERNS[0][0] // [90, 810, 1592, 0]

describe('타구 궤적 — 원본 패턴의 각·세기·높이만 읽어 근사한다', () => {
  it('각 45 는 1루 쪽, 135 는 3루 쪽, 90 은 가운데로 간다', () => {
    const 오른쪽 = landingPointOf(battedBallTrajectory([45, 1000, 800, 0]))
    const 가운데 = landingPointOf(battedBallTrajectory([90, 1000, 800, 0]))
    const 왼쪽 = landingPointOf(battedBallTrajectory([135, 1000, 800, 0]))

    expect(오른쪽.x).toBeGreaterThan(BATTING_POINT.x)
    expect(왼쪽.x).toBeLessThan(BATTING_POINT.x)
    expect(가운데.x).toBe(BATTING_POINT.x)
    // 셋 다 외야(z 가 작아지는 쪽)로 간다
    for (const point of [오른쪽, 가운데, 왼쪽]) expect(point.z).toBeLessThan(BATTING_POINT.z)
  })

  it('세기가 크면 더 멀리 간다', () => {
    const 약 = carryDistanceOf(battedBallTrajectory([90, 600, 1200, 0]))
    const 강 = carryDistanceOf(battedBallTrajectory([90, 1300, 1200, 0]))

    expect(강).toBeGreaterThan(약)
  })

  it('높이가 크면 더 오래 떠 있다', () => {
    const 낮 = battedBallTrajectory([90, 900, 300, 0])
    const 높 = battedBallTrajectory([90, 900, 1500, 0])

    expect(높.landingTick).toBeGreaterThan(낮.landingTick)
  })

  it('플래그 비트0 은 높이 부호를 뒤집는다 (0xb0614) — 내리꽂는 타구가 된다', () => {
    const 보통 = battedBallTrajectory([90, 900, 900, 0])
    const 반전 = battedBallTrajectory([90, 900, 900, 1])

    expect(반전.landingTick).toBeLessThan(보통.landingTick)
    expect(반전.pointAt(1).y).toBeLessThan(보통.pointAt(1).y)
  })

  it('낙구 틱은 높이가 처음 0 이하가 된 점이다 (공 +0xaa0)', () => {
    const 궤적 = battedBallTrajectory(깊은뜬공)

    expect(궤적.pointAt(궤적.landingTick).y).toBe(0)
    expect(궤적.pointAt(궤적.landingTick - 1).y).toBeGreaterThan(0)
  })

  it('점 목록은 130 개를 넘지 않고, 밖의 틱은 양끝으로 자른다 (0xa2b78)', () => {
    const 궤적 = battedBallTrajectory(깊은뜬공)

    expect(궤적.length).toBeLessThanOrEqual(MAXIMUM_TRAJECTORY_POINTS)
    expect(궤적.pointAt(-5)).toEqual(궤적.pointAt(0))
    expect(궤적.pointAt(9999)).toEqual(궤적.pointAt(궤적.length - 1))
  })

  it('시작점은 원본 배팅 지점 (20000, 1000, 30000) 이다', () => {
    const 궤적 = battedBallTrajectory(깊은뜬공)

    expect(궤적.pointAt(0)).toEqual(BATTING_POINT)
    expect(궤적.startedAtPlate).toBe(true)
    expect(battedBallTrajectory(깊은뜬공, { origin: { x: 0, y: 0, z: 0 } }).startedAtPlate).toBe(false)
  })

  it('담장을 넘으면 그 틱이 +0xaa4 에 남고 거기서 궤적이 끝난다', () => {
    const 홈런성 = battedBallTrajectory([90, 1400, 1500, 0])

    expect(clearedFence(홈런성)).toBe(true)
    expect(horizontalDistance(BASE_POSITIONS[0], 홈런성.pointAt(홈런성.fenceTick))).toBeGreaterThan(
      FENCE_DISTANCE,
    )
    expect(홈런성.fenceTick).toBe(홈런성.length - 1)
  })

  it('약한 타구는 담장에 못 닿는다', () => {
    expect(clearedFence(battedBallTrajectory([90, 400, 600, 0]))).toBe(false)
  })

  it('폴 접촉(+0xab0)은 수평각이 파울선과 정확히 같을 때만 본다', () => {
    expect(battedBallTrajectory([45, 1500, 1400, 0]).poleTick).toBeGreaterThanOrEqual(0)
    expect(battedBallTrajectory([135, 1500, 1400, 0]).poleTick).toBeGreaterThanOrEqual(0)
    expect(battedBallTrajectory([90, 1500, 1400, 0]).poleTick).toBe(-1)
    // 담장을 못 넘으면 폴도 없다
    expect(battedBallTrajectory([45, 400, 500, 0]).poleTick).toBe(-1)
  })

  it('땅에 닿은 뒤에도 튀고 굴러 결국 멈춘다 — 굴러간 공을 야수가 주울 수 있어야 한다', () => {
    const 땅볼 = battedBallTrajectory([90, 1000, 250, 0])
    const 마지막 = 땅볼.pointAt(땅볼.length - 1)

    expect(땅볼.landingTick).toBeLessThan(땅볼.length - 1)
    expect(마지막.y).toBe(0)
    // 낙구 지점보다 더 굴러가 있다
    expect(마지막.z).toBeLessThan(landingPointOf(땅볼).z)
  })

  it('원본 패턴 표 전체가 좌표 폭주 없이 궤적이 된다', () => {
    for (const patterns of Object.values(BATTED_BALL_PATTERNS)) {
      for (const pattern of patterns) {
        const 궤적 = battedBallTrajectory(pattern)
        expect(궤적.length).toBeGreaterThan(1)
        expect(궤적.length).toBeLessThanOrEqual(MAXIMUM_TRAJECTORY_POINTS)
        const 끝 = 궤적.pointAt(궤적.length - 1)
        expect(Number.isFinite(끝.x) && Number.isFinite(끝.z)).toBe(true)
        // 담장 안에서 멈추거나, 담장을 넘은 그 점에서 끝난다
        expect(horizontalDistance(BASE_POSITIONS[0], 끝)).toBeLessThanOrEqual(FENCE_DISTANCE + 2_500)
      }
    }
  })
})
