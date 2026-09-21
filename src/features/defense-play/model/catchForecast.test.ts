import { describe, expect, it } from 'vitest'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import { FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import { createFielders } from '@/entities/fielding/model/fieldingState'
import { forecastCatch, nearestSlotTo } from '@/features/defense-play/model/catchForecast'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))

/** 뜬 채로 잡히는 타구가 보는 구간 */
const 뜬공구간 = (landingTick: number) => ({ from: 0, to: landingTick })

describe('포구 예보 — 가장 먼저 닿는 야수가 잡는다 (P2 2a)', () => {
  it('가운데 깊은 뜬공은 중견수(8)가 잡는다', () => {
    const 궤적 = battedBallTrajectory([90, 900, 1500, 0])
    const 예보 = forecastCatch(궤적, 야수들, 뜬공구간(궤적.landingTick))

    expect(예보.choice.slot).toBe(8)
    expect(예보.choice.catchTick).toBeLessThanOrEqual(궤적.landingTick)
  })

  it('3루 쪽으로 뜬 깊은 공은 좌익(7)이 잡는다', () => {
    const 궤적 = battedBallTrajectory([125, 950, 1450, 0])
    const 예보 = forecastCatch(궤적, 야수들, 뜬공구간(궤적.landingTick))

    expect(예보.choice.slot).toBe(7)
  })

  it('1루 쪽으로 뜬 깊은 공은 우익(6)이 잡는다', () => {
    const 궤적 = battedBallTrajectory([55, 950, 1450, 0])
    const 예보 = forecastCatch(궤적, 야수들, 뜬공구간(궤적.landingTick))

    expect(예보.choice.slot).toBe(6)
  })

  it('낙구 다음 틱부터 보면 굴러간 공을 줍는 것이라 포구 틱이 낙구 틱보다 뒤다', () => {
    const 땅볼: BattedBallPattern = [90, 900, 250, 0]
    const 궤적 = battedBallTrajectory(땅볼)
    const 예보 = forecastCatch(궤적, 야수들, {
      from: 궤적.landingTick + 1,
      to: Number.POSITIVE_INFINITY,
    })

    expect(예보.choice.catchTick).toBeGreaterThan(궤적.landingTick)
    // 굴러가는 공은 높이가 0 이라 "낮은 공"(표 +0x60) 으로 잡힌다
    expect(예보.choice.kind).toBe(CATCH_KIND.LOW)
    expect(예보.choice.actionStartTick).toBe(예보.choice.catchTick)
  })

  it('가장 이른 포구 틱(+0x11c)을 함께 알려 준다', () => {
    const 궤적 = battedBallTrajectory([90, 900, 1500, 0])
    const 예보 = forecastCatch(궤적, 야수들, 뜬공구간(궤적.landingTick))

    expect(예보.earliestCatchTick).toBeLessThanOrEqual(예보.choice.catchTick)
    expect(예보.point).toEqual(궤적.pointAt(예보.choice.catchTick))
  })

  it('가장 가까운 야수 고르기 — 시작 좌표에 딱 맞춰 보면 그 야수가 나온다', () => {
    FIELDER_START_POSITIONS.forEach((point, slot) => {
      expect(nearestSlotTo(야수들, point)).toBe(slot)
    })
  })
})

/**
 * 전에는 "제 시간에 닿는 야수는 공 지점에 서 있다"(`fielder: ball`)로 판정해 **거리가 늘 0** 이었다.
 * 그래서 포구 반경(내야 500 · 외야 300)도 슬라이딩 창(1999 < d ≤ 3000)도 영원히 거짓이었다.
 * 아래 두 가지가 그 자리를 지킨다.
 */
describe('거리 d 가 실제로 계산된다 — 포구 반경과 필살 창이 살아 있다 (P2 2a)', () => {
  it('필살 슬라이딩 창을 열면 슬라이딩 캐치(종류 4)가 실제로 골라진다', () => {
    const 궤적 = battedBallTrajectory([92, 955, 1159, 0])
    const 닫힘 = forecastCatch(궤적, 야수들, 뜬공구간(궤적.landingTick))
    const 열림 = forecastCatch(궤적, 야수들, 뜬공구간(궤적.landingTick), { slideUnlocked: true })

    expect(닫힘.table.slide).toBeNull()
    expect(열림.table.slide).not.toBeNull()
    expect(열림.choice.kind).toBe(CATCH_KIND.SLIDE)
    // 동작은 포구 6틱 전에 시작한다 (분기표 0xd87c0)
    expect(열림.choice.actionStartTick).toBe(열림.choice.catchTick - 6)
  })

  it('창을 안 열면 필살 두 종류는 표에 아예 안 적힌다', () => {
    const 궤적 = battedBallTrajectory([90, 900, 1500, 0])
    const 예보 = forecastCatch(궤적, 야수들, 뜬공구간(궤적.landingTick))

    expect(예보.table.jump).toBeNull()
    expect(예보.table.slide).toBeNull()
  })

  it('포수(타구 시작 때의 추적야수)는 4틱까지 건너뛴다 — 홈플레이트 위 공을 제자리에서 줍지 못한다', () => {
    const 궤적 = battedBallTrajectory([90, 900, 1500, 0])
    const 예보 = forecastCatch(궤적, 야수들, 뜬공구간(궤적.landingTick))

    expect(예보.choice.catchTick).toBeGreaterThan(4)
    expect(예보.choice.slot).not.toBe(1)
  })
})
