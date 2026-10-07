import { describe, expect, it } from 'vitest'
import { DERBY_PLAY_CLOSE_TICKS, derbyBallStopTickOf, derbyBattedBallOf } from '@/entities/home-run-derby/model/derbyBattedBall'
import { DERBY_DISTANCE_LIMIT } from '@/entities/home-run-derby/model/derbyRules'
import { isBigFlyPattern, isEventZoneHit, isEventZoneVisibleAt } from '@/entities/home-run-derby/model/eventZone'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'

/** 홈런성 결과 코드 */
const 홈런코드 = 24
/** 그 묶음의 빠른 타구 한 장 */
const 빠른홈런 = [75, 1451, 1004, 0] as const

describe('타구 한 장 만들기', () => {
  it('타석이 뽑은 패턴을 그대로 쓴다 — 다시 뽑지 않는다', () => {
    for (const pattern of BATTED_BALL_PATTERNS[홈런코드]!) {
      expect(derbyBattedBallOf(pattern, true).pattern).toBe(pattern)
    }
  })

  it('홈런이면 비거리가 붙고, 아니면 0 이다', () => {
    expect(derbyBattedBallOf(빠른홈런, true).distance).toBeGreaterThan(0)
    expect(derbyBattedBallOf(빠른홈런, false).distance).toBe(0)
  })

  it('비거리는 상한 160 을 넘지 않는다', () => {
    for (const pattern of BATTED_BALL_PATTERNS[홈런코드]!) {
      expect(derbyBattedBallOf(pattern, true).distance).toBeLessThanOrEqual(DERBY_DISTANCE_LIMIT)
    }
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
    const 공 = derbyBattedBallOf([126, 1337, 1006, 0], true)
    const 멈춘틱 = derbyBallStopTickOf(공.trajectory)

    expect(공.trajectory.isStoppedAt?.(멈춘틱)).toBe(true)
    expect(공.trajectory.isStoppedAt?.(멈춘틱 - 1)).toBe(false)
    expect(멈춘틱).toBe(공.trajectory.length - 1)
    expect(공.endTicks).toBe(멈춘틱 + DERBY_PLAY_CLOSE_TICKS)
  })
})
