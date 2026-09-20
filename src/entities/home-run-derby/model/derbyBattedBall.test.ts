import { describe, expect, it } from 'vitest'
import { derbyBattedBallOf } from '@/entities/home-run-derby/model/derbyBattedBall'
import { DERBY_DISTANCE_LIMIT } from '@/entities/home-run-derby/model/derbyRules'
import { isEventZoneHit, isEventZoneVisibleAt } from '@/entities/home-run-derby/model/eventZone'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { outcomeOfPattern } from '@/entities/batting/model/battedBallOutcome'

/** 홈런 결과 코드 — `outcomeOfPattern` 의 마지막 갈래(21·24 묶음)에서 세기 1100 이상이 홈런이다 */
const 홈런코드 = 24

describe('타구 한 장 만들기', () => {
  it('홈런이면 원본 표에서 홈런으로 판정되는 패턴을 고른다', () => {
    const random = createSeededRandom(7)
    for (let index = 0; index < 20; index += 1) {
      const batted = derbyBattedBallOf(홈런코드, true, random)!
      const judged = outcomeOfPattern(홈런코드, batted.pattern, random)
      expect(judged.kind === '타구' && judged.outcome.kind).toBe('홈런')
    }
  })

  it('홈런이면 비거리가 붙고, 아니면 0 이다', () => {
    const random = createSeededRandom(11)
    expect(derbyBattedBallOf(홈런코드, true, random)!.distance).toBeGreaterThan(0)
    expect(derbyBattedBallOf(0, false, random)!.distance).toBe(0)
  })

  it('비거리는 상한 160 을 넘지 않는다', () => {
    const random = createSeededRandom(3)
    for (let index = 0; index < 50; index += 1) {
      expect(derbyBattedBallOf(홈런코드, true, random)!.distance).toBeLessThanOrEqual(DERBY_DISTANCE_LIMIT)
    }
  })

  it('패턴이 없는 결과 코드는 null 이다 (21~23 은 원본 표에 없다)', () => {
    expect(derbyBattedBallOf(21, true, createSeededRandom(1))).toBeNull()
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
