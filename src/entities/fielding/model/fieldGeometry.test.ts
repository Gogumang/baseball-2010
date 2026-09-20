import { describe, expect, it } from 'vitest'
import {
  abilityGradeOf,
  BASE_DEFAULT_FIELDER,
  BASE_POSITIONS,
  BASE_SCORE,
  FIELDER_SPEED,
  FIELDER_START_POSITIONS,
  basePosition,
  horizontalDistance,
  isOutfieldSlot,
  isSamePoint,
  progressPercent,
  runnerSpeedOf,
  SLIDING_SPEED_BONUS,
  stepToward,
  ticksToReach,
  UNREACHABLE_TICKS,
  WORLD_DEPTH,
  WORLD_WIDTH,
} from '@/entities/fielding/model/fieldGeometry'

describe('수비 좌표계 — 0xd856c · 0xd86ec · cfg', () => {
  it('월드는 40000 × 32500 이다 (R3 1절)', () => {
    expect([WORLD_WIDTH, WORLD_DEPTH]).toEqual([40_000, 32_500])
  })

  it('루 좌표 0xd856c 를 그대로 쓴다 — 리드 폭을 더하는 코드가 원본에 없다', () => {
    expect(BASE_POSITIONS.map((point) => [point.x, point.z])).toEqual([
      [20_000, 29_445],
      [25_946, 24_175],
      [20_000, 19_170],
      [14_055, 24_175],
    ])
  })

  it('루 번호 4 는 홈의 사본이다 (원본 표가 5칸)', () => {
    expect(basePosition(4)).toEqual(BASE_POSITIONS[0])
    expect(basePosition(5)).toEqual(BASE_POSITIONS[1])
    expect(basePosition(-1)).toEqual(BASE_POSITIONS[3])
  })

  it('야수 시작 좌표 0xd86ec 는 9칸이고 칸 6·7·8 이 외야다', () => {
    expect(FIELDER_START_POSITIONS).toHaveLength(9)
    expect(FIELDER_START_POSITIONS[0]).toEqual({ x: 20_000, y: 0, z: 24_500 })
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(isOutfieldSlot)).toEqual([
      false, false, false, false, false, false, true, true, true,
    ])
  })

  it('루 담당 기본 야수 0xd85a8 = [1,2,3,4], 루 기본 점수 0xd85ac = [4000,1000,2000,3000]', () => {
    expect(BASE_DEFAULT_FIELDER).toEqual([1, 2, 3, 4])
    expect(BASE_SCORE).toEqual([4000, 1000, 2000, 3000])
  })
})

describe('이동 속도 — 야수는 능력치 무관 220, 주자는 300 + 주루×7/100', () => {
  it('야수는 전원 220/틱 이다 (cfg+0x18)', () => {
    expect(FIELDER_SPEED).toBe(220)
  })

  it('주자 속도표', () => {
    const 표: readonly [number, number][] = [
      [0, 300],
      [100, 307],
      [500, 335],
      [999, 369],
    ]
    표.forEach(([run, speed]) => expect(runnerSpeedOf(run)).toBe(speed))
  })

  it('팀 등급은 그대로 더해진다 (전역 모드 1·2·8 에서만)', () => {
    expect(runnerSpeedOf(500, 7)).toBe(342)
  })

  it('가장 느린 주자도 야수보다 빠르다 (300 / 220 ≈ 1.36배)', () => {
    expect(runnerSpeedOf(0)).toBeGreaterThan(FIELDER_SPEED)
  })

  it('슬라이딩 중에는 +40 이다 (0xa0164)', () => {
    expect(runnerSpeedOf(500) + SLIDING_SPEED_BONUS).toBe(375)
  })
})

describe('거리·틱·한 틱 이동', () => {
  it('평면 거리는 정수 제곱근이다 (높이를 보지 않는다)', () => {
    expect(horizontalDistance(BASE_POSITIONS[0], BASE_POSITIONS[1])).toBe(7945)
    expect(horizontalDistance(BASE_POSITIONS[0], BASE_POSITIONS[2])).toBe(10_275)
    expect(horizontalDistance({ x: 0, y: 9999, z: 0 }, { x: 3, y: 0, z: 4 })).toBe(5)
  })

  it('도착 틱은 거리 ÷ 속도 버림, 속도 0 이면 1000 (0xbf01c)', () => {
    expect(ticksToReach(BASE_POSITIONS[0], BASE_POSITIONS[1], 335)).toBe(23)
    expect(ticksToReach(BASE_POSITIONS[0], BASE_POSITIONS[1], 0)).toBe(UNREACHABLE_TICKS)
  })

  it('남은 거리가 속도 이하면 목표에 정확히 붙는다 — 그래서 루 위 좌표가 루 좌표와 같다', () => {
    const 붙음 = stepToward({ x: 19_900, y: 0, z: 29_445 }, BASE_POSITIONS[0], 220)
    expect(isSamePoint(붙음, BASE_POSITIONS[0])).toBe(true)
  })

  it('멀면 속도만큼만 간다', () => {
    const 한틱 = stepToward({ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, 220)
    expect(한틱).toEqual({ x: 220, y: 0, z: 0 })
  })

  it('진행률은 출발 루 기준 퍼센트다 (주자 vt90 = 0xa04e8)', () => {
    const 반 = { x: 22_973, y: 0, z: 26_810 }
    expect(progressPercent(BASE_POSITIONS[0], BASE_POSITIONS[0], BASE_POSITIONS[1])).toBe(0)
    expect(progressPercent(BASE_POSITIONS[0], BASE_POSITIONS[1], BASE_POSITIONS[1])).toBe(100)
    expect(progressPercent(BASE_POSITIONS[0], 반, BASE_POSITIONS[1])).toBeGreaterThan(45)
    expect(progressPercent(BASE_POSITIONS[0], 반, BASE_POSITIONS[1])).toBeLessThan(55)
  })
})

describe('능력치 등급 0xbbe98', () => {
  it('경계값 표', () => {
    const 표: readonly [number, number][] = [
      [0, 0],
      [125, 0],
      [126, 1],
      [250, 1],
      [375, 2],
      [525, 3],
      [675, 4],
      [825, 5],
      [925, 6],
      [926, 7],
      [999, 7],
    ]
    표.forEach(([ability, grade]) => expect(abilityGradeOf(ability)).toBe(grade))
  })
})
