import { describe, expect, it } from 'vitest'
import {
  DERBY_PLAY_CLOSE_TICKS,
  derbyBallStopTickOf,
  derbyBattedBallOf,
  derbyDisplayDistanceAt,
  skipDerbyBattedBall,
} from '@/entities/home-run-derby/model/derbyBattedBall'
import { DERBY_DISTANCE_LIMIT, derbyDistanceOf } from '@/entities/home-run-derby/model/derbyRules'
import { battedBallTrajectory, isBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { isBigFlyPattern, isEventZoneHit, isEventZoneVisibleAt } from '@/entities/home-run-derby/model/eventZone'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'

/** 홈런성 결과 코드 */
const 홈런코드 = 24
/** 그 묶음의 빠른 타구 한 장 */
const 빠른홈런 = [75, 1451, 1004, 0] as const

describe('홈런더비 판(종류 8) 하나 — 슬롯 2 모드 7 갈래 0x526ca', () => {
  it('타석이 뽑은 패턴을 그대로 쓴다 — 다시 뽑지 않는다', () => {
    for (const pattern of BATTED_BALL_PATTERNS[홈런코드]!) {
      expect(derbyBattedBallOf(pattern).pattern).toBe(pattern)
    }
  })

  it('홈런은 땅에 닿기 전에 담장선을 넘은 페어 공 — 낙구 점 비거리를 더하고 그 틱에 11', () => {
    const 공 = derbyBattedBallOf(빠른홈런)
    expect(공.isHomeRun).toBe(true)
    expect(공.homeRunTicks).toEqual([공.trajectory.fenceTick])
    expect(공.trajectory.landingTick).toBeGreaterThanOrEqual(공.trajectory.fenceTick)
    expect(공.distance).toBe(derbyDistanceOf(공.trajectory.pointAt(공.trajectory.landingTick)))
    expect(공.foulCallTick).toBeNull()
    // 표시 비거리 +0x36 — 낙구 틱까지 지금 점으로 다시 써서 낙구 점 값이 남는다 (526d0)
    expect(공.displayDistance).toBe(derbyDistanceOf(공.trajectory.pointAt(공.trajectory.landingTick)))
  })

  it('⚠️ 원본 그대로: 홈런 아닌 페어 공도 낙구 틱에 그 점 비거리를 더한다 (0xa600c 의 state[0x26] == 8 은 판 종류)', () => {
    const 뜬공 = derbyBattedBallOf(BATTED_BALL_PATTERNS[15]![0]!)
    expect(뜬공.isHomeRun).toBe(false)
    expect(뜬공.distance).toBe(derbyDistanceOf(뜬공.trajectory.pointAt(뜬공.trajectory.landingTick)))
    expect(뜬공.distance).toBeGreaterThan(0)
    expect(뜬공.homeRunTicks).toEqual([])
  })

  it('파울 각 공은 비거리 0 · 홈런 아님 · 낙구 틱에 "Foul!" 25 (0x5284a)', () => {
    const 파울패턴 = Object.values(BATTED_BALL_PATTERNS)
      .flat()
      .find((pattern) => !isFairAngle(pattern[0]) && battedBallTrajectory(pattern).fenceTick > 0)!
    const 파울 = derbyBattedBallOf(파울패턴)
    expect(파울.isHomeRun).toBe(false)
    expect(파울.distance).toBe(0)
    expect(파울.foulCallTick).toBe(파울.trajectory.landingTick)
    // 표시 비거리 +0x36 은 파울도 낙구 점으로 쓴다 (526d0 은 0xb68dc 를 안 본다)
    expect(파울.displayDistance).toBe(derbyDistanceOf(파울.trajectory.pointAt(파울.trajectory.landingTick)))
  })

  it('비거리는 한 번에 상한 160 을 넘지 않는다', () => {
    for (const pattern of BATTED_BALL_PATTERNS[홈런코드]!) {
      expect(derbyBattedBallOf(pattern).distance).toBeLessThanOrEqual(DERBY_DISTANCE_LIMIT)
    }
  })

  it('판 안 굴림은 폴 충돌 rand(−25, 25) 하나뿐 — 폴에 안 맞는 공은 난수를 안 쓴다', () => {
    const 센다 = (pattern: readonly [number, number, number, number]) => {
      const seeded = createSeededRandom(7)
      let 굴림 = 0
      const random = {
        next: () => {
          굴림 += 1
          return seeded.next()
        },
        nextInRange: (minimum: number, maximum: number) => {
          굴림 += 1
          return seeded.nextInRange(minimum, maximum)
        },
        pick: seeded.pick,
      }
      derbyBattedBallOf(pattern, random)
      return 굴림
    }
    // 원본 표 24[18] 은 폴(ab0)에 맞는다 (I 2b 표본)
    const 폴 = BATTED_BALL_PATTERNS[홈런코드]![18]!
    expect(battedBallTrajectory(폴).poleTick).toBeGreaterThan(0)
    expect(센다(폴)).toBe(1)
    expect(센다(빠른홈런)).toBe(0)
  })
})

describe('이벤트 존 — 플레이 +0x127 = 패턴 플래그 & 2 (0xb07c8)', () => {
  it('플래그 비트1 이 선 패턴만 존을 얻는다 — 높이와 상관없다', () => {
    expect(isEventZoneHit({ pattern: [118, 961, 1367, 2] })).toBe(true)
    expect(isEventZoneHit({ pattern: [90, 815, 1592, 0] })).toBe(false)
    expect(isEventZoneHit({ pattern: [10, 900, 600, 3] })).toBe(true)
  })

  it('맞은 공이 아니면 안 뜬다', () => {
    expect(isEventZoneHit({ pattern: null })).toBe(false)
  })

  it('한 공에 한 번만 놓인다', () => {
    expect(isEventZoneHit({ pattern: [118, 961, 1367, 2], isZonePlaced: true })).toBe(false)
  })

  it('비트1 이 선 패턴은 원본 표에서 결과 18~20 에 몰려 있다 (P7 H1)', () => {
    const 센다 = (code: number) => (BATTED_BALL_PATTERNS[code] ?? []).filter(isBigFlyPattern).length
    expect([센다(18), 센다(19), 센다(20)]).toEqual([35, 15, 15])
  })

  it('8프레임 주기로 깜빡인다', () => {
    const 보임 = Array.from({ length: 16 }, (_unused, tick) => isEventZoneVisibleAt(tick))
    expect(보임.slice(0, 8)).toEqual(보임.slice(8, 16))
    expect(보임.filter(Boolean)).toHaveLength(8)
  })
})

describe('판 끝 — 관문 0xb0d28 의 +0x125 갈래(공.vt18 멈춤) 뒤 10틱', () => {
  it('처음 멈춘 점의 틱 + 10 이다 — 원본 코드 24 [126, 1337, 1006]', () => {
    const 공 = derbyBattedBallOf([126, 1337, 1006, 0])
    const 멈춘틱 = derbyBallStopTickOf(공.trajectory)

    expect(공.trajectory.isStoppedAt?.(멈춘틱)).toBe(true)
    expect(공.trajectory.isStoppedAt?.(멈춘틱 - 1)).toBe(false)
    expect(멈춘틱).toBe(공.trajectory.length - 1)
    expect(공.endTicks).toBe(멈춘틱 + DERBY_PLAY_CLOSE_TICKS)
  })
})

describe('비거리 판 0x36cd4 의 숫자 — 표시 비거리 +0x36 을 틱마다 다시 쓴다 (526d0)', () => {
  it('낙구 틱까지 지금 점 비거리를 따라 쓰고, 그 뒤로는 낙구 점 값이 남는다', () => {
    const 공 = derbyBattedBallOf(빠른홈런)
    const 낙구 = 공.trajectory.landingTick
    expect(공.displayDistanceTicks.map((written) => written.tick)).toEqual(
      Array.from({ length: Math.min(낙구, 공.closeTick - 1) }, (_unused, index) => index + 1),
    )
    expect(derbyDisplayDistanceAt(공, 0, 37)).toBe(37)
    expect(derbyDisplayDistanceAt(공, 3, 37)).toBe(derbyDistanceOf(공.trajectory.pointAt(3)))
    expect(derbyDisplayDistanceAt(공, 공.endTicks, 37)).toBe(공.displayDistance)
  })
})

describe('홈런 뒤 키로 건너뛰기 — 0x587 → 0x519cc 의 +0xfe7 → 5284e 가 공 틱을 0xbf01c 로 넘긴다', () => {
  it('홈런 틱 다음부터 받은 키는 그 틱의 갈래를 돈 뒤 다음 틱에 관문을 닫는다 — 판 끝 = 키 틱 + 1 + 10', () => {
    const 공 = derbyBattedBallOf(빠른홈런)
    const 홈런틱 = 공.homeRunTicks[0]!
    expect(공.closeTick).toBeGreaterThan(홈런틱 + 2)
    const 건너뜀 = skipDerbyBattedBall(공, 홈런틱 + 1)
    expect(건너뜀.skippedAtTick).toBe(홈런틱 + 1)
    expect(건너뜀.closeTick).toBe(홈런틱 + 2)
    expect(건너뜀.endTicks).toBe(홈런틱 + 2 + DERBY_PLAY_CLOSE_TICKS)
    expect(건너뜀.isHomeRun).toBe(true)
    // 표시 비거리는 키 틱까지만 다시 쓴다 — 낙구 전에 건너뛰면 그 틱의 점 값이 남는다
    if (공.trajectory.landingTick > 홈런틱 + 1) {
      expect(건너뜀.displayDistance).toBe(derbyDistanceOf(공.trajectory.pointAt(홈런틱 + 1)))
    }
    // 홈런 갈래의 비거리는 낙구 점으로 이미 더했다
    expect(건너뜀.distance).toBe(공.distance)
  })

  it('홈런 틱 전 · 그 틱(아직 state[0x1d] 가 안 섰다) · 관문이 닫힌 뒤의 키는 아무것도 안 바꾼다', () => {
    const 공 = derbyBattedBallOf(빠른홈런)
    const 홈런틱 = 공.homeRunTicks[0]!
    expect(skipDerbyBattedBall(공, 홈런틱)).toBe(공)
    expect(skipDerbyBattedBall(공, 1)).toBe(공)
    expect(skipDerbyBattedBall(공, 공.closeTick)).toBe(공)
    const 뜬공 = derbyBattedBallOf(BATTED_BALL_PATTERNS[15]![0]!)
    expect(skipDerbyBattedBall(뜬공, 3)).toBe(뜬공)
  })

  it('원본 패턴 표의 더비 홈런은 모두 미리 계산이 멈춤으로 끝난다 — 0xbf01c 는 1000, 점 꺼내기가 마지막 점으로 자른다', () => {
    let 홈런 = 0
    for (const pattern of Object.values(BATTED_BALL_PATTERNS).flat()) {
      const 공 = derbyBattedBallOf(pattern)
      if (!공.isHomeRun) continue
      홈런 += 1
      expect(공.trajectory.isStoppedAt?.(공.trajectory.length - 1)).toBe(true)
      // 미리 계산이 끝난 공의 +0x3c(수평 속도) = 0 → 0xbf01c 는 1000
      expect(isBallTrajectory(공.trajectory) && 공.trajectory.flight.body.speed).toBe(0)
    }
    expect(홈런).toBe(99)
  })
})
