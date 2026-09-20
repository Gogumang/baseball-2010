import { describe, expect, it } from 'vitest'
import {
  ACE_STAGE_THRESHOLDS,
  DERBY_DISTANCE_DIVISOR,
  DERBY_DISTANCE_LIMIT,
  DERBY_DISTANCE_ORIGIN,
  DERBY_PITCH_COUNT,
  DERBY_ZONE_CENTERS,
  GAME_POINT_LIMIT,
  GAME_POINT_MULTIPLIERS,
  addDerbyGamePoint,
  derbyDistanceOf,
  derbyGamePointOf,
  nextAceStageOf,
} from '@/entities/home-run-derby/model/derbyRules'

describe('비거리 — d = |착지점 − (20000,1000,30000)| / 265, 상한 160', () => {
  it('기준점은 원본 표 0xd81f8 = (20000, 1000, 30000)', () => {
    expect(DERBY_DISTANCE_ORIGIN).toEqual({ x: 20_000, y: 1_000, z: 30_000 })
  })

  it('기준점에 그대로 떨어지면 0 이다', () => {
    expect(derbyDistanceOf({ x: 20_000, y: 1_000, z: 30_000 })).toBe(0)
  })

  it('265 로 나눈 몫이다 (버림)', () => {
    // z 로 정확히 265 × 40 = 10600 만큼 나간 타구
    expect(derbyDistanceOf({ x: 20_000, y: 1_000, z: 30_000 - 10_600 })).toBe(40)
    // 264 는 아직 0 이고 265 에서 1 이 된다
    expect(derbyDistanceOf({ x: 20_000, y: 1_000, z: 30_000 - 264 })).toBe(0)
    expect(derbyDistanceOf({ x: 20_000, y: 1_000, z: 30_000 - 265 })).toBe(1)
  })

  it('3차원 거리다 — 높이도 센다', () => {
    const 대각선 = derbyDistanceOf({ x: 20_000 + 3 * DERBY_DISTANCE_DIVISOR, y: 1_000 + 4 * DERBY_DISTANCE_DIVISOR, z: 30_000 })
    expect(대각선).toBe(5)
  })

  it('한 타구 상한은 160 이다 (0xa606a)', () => {
    const 아주멀리 = derbyDistanceOf({ x: 20_000, y: 1_000, z: 30_000 - 1_000 * DERBY_DISTANCE_DIVISOR })
    expect(아주멀리).toBe(DERBY_DISTANCE_LIMIT)
  })

  it('정확히 160 이어도 160 이다 (bge 라 경계 포함)', () => {
    expect(derbyDistanceOf({ x: 20_000, y: 1_000, z: 30_000 - 160 * DERBY_DISTANCE_DIVISOR })).toBe(160)
  })
})

describe('마투수 단계 문턱 [800, 1200, 1600, 2000]', () => {
  it('표는 원본 0xd84dc 그대로다 (끝의 99999 포함)', () => {
    expect(ACE_STAGE_THRESHOLDS).toEqual([800, 1200, 1600, 2000, 99_999])
  })

  it('문턱을 못 넘으면 단계가 그대로다', () => {
    expect(nextAceStageOf(0, 799)).toBe(0)
  })

  it('문턱에 닿으면(≥) 단계가 오른다', () => {
    expect(nextAceStageOf(0, 800)).toBe(1)
    expect(nextAceStageOf(1, 1_200)).toBe(2)
    expect(nextAceStageOf(2, 1_600)).toBe(3)
    expect(nextAceStageOf(3, 2_000)).toBe(4)
  })

  it('한 번에 한 단계만 오른다 — 누적이 아무리 커도 +1 이다', () => {
    expect(nextAceStageOf(0, 9_999)).toBe(1)
  })

  it('단계 4 는 문턱 99999 라 사실상 더 안 오른다', () => {
    expect(nextAceStageOf(4, 2_500)).toBe(4)
  })
})

describe('G = (누적 비거리 / 100) × 배율[단계] + 보너스 G', () => {
  it('배율 표는 [1, 2, 3, 4, 5] 다 (0xcfb10)', () => {
    expect(GAME_POINT_MULTIPLIERS).toEqual([1, 2, 3, 4, 5])
  })

  it('누적/100 은 버림이다', () => {
    expect(derbyGamePointOf(199, 0, 0)).toBe(1)
    expect(derbyGamePointOf(200, 0, 0)).toBe(2)
  })

  it('단계가 오르면 배율이 곱해진다', () => {
    expect(derbyGamePointOf(1_000, 0, 0)).toBe(10)
    expect(derbyGamePointOf(1_000, 1, 0)).toBe(20)
    expect(derbyGamePointOf(1_000, 4, 0)).toBe(50)
  })

  it('보너스 G 는 배율 뒤에 더한다', () => {
    expect(derbyGamePointOf(1_000, 2, 245)).toBe(10 * 3 + 245)
  })

  it('99999 상한', () => {
    expect(derbyGamePointOf(30_000, 4, 99_999)).toBe(GAME_POINT_LIMIT)
  })

  it('정산도 보유 G 를 99999 로 자른다 (0x4f6ea)', () => {
    expect(addDerbyGamePoint(99_000, 500)).toBe(99_500)
    expect(addDerbyGamePoint(99_900, 500)).toBe(GAME_POINT_LIMIT)
  })
})

describe('그 밖의 확정 수치', () => {
  it('기회는 10구다', () => {
    expect(DERBY_PITCH_COUNT).toBe(10)
  })

  it('단계 0 목표점은 좌우별 존 중심 고정이다 (표 0xcfbcc)', () => {
    expect(DERBY_ZONE_CENTERS.left).toEqual({ x: 19_415, y: 1_202, z: 29_705 })
    expect(DERBY_ZONE_CENTERS.right).toEqual({ x: 20_585, y: 1_202, z: 29_705 })
  })
})
