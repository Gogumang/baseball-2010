import { describe, expect, it } from 'vitest'
import { derbyBattedBallOf } from '@/entities/home-run-derby/model/derbyBattedBall'
import { DERBY_DISTANCE_LIMIT } from '@/entities/home-run-derby/model/derbyRules'
import { isEventZoneHit, isEventZoneVisibleAt } from '@/entities/home-run-derby/model/eventZone'
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

describe('이벤트 존 (유력 — 원본 조건 한 고리가 미확인)', () => {
  it('높이 뜬 타구만 존을 얻는다', () => {
    expect(isEventZoneHit({ apexHeight: 6_000 })).toBe(true)
    expect(isEventZoneHit({ apexHeight: 4_000 })).toBe(false)
  })

  it('필드 플래그(+0x127)가 서 있지 않으면 안 뜬다', () => {
    expect(isEventZoneHit({ apexHeight: 6_000, hasFieldFlag: false })).toBe(false)
  })

  it('한 공에 한 번만 놓인다', () => {
    expect(isEventZoneHit({ apexHeight: 6_000, isZonePlaced: true })).toBe(false)
  })

  it('8프레임 주기로 깜빡인다', () => {
    const 보임 = Array.from({ length: 16 }, (_unused, tick) => isEventZoneVisibleAt(tick))
    expect(보임.slice(0, 8)).toEqual(보임.slice(8, 16))
    expect(보임.filter(Boolean)).toHaveLength(8)
  })
})
