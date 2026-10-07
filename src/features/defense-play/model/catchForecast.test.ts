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
    // 원본 코드 0 [92, 895, 1017] — 낙구 24 전 23틱에 중견수
    const 궤적 = battedBallTrajectory([92, 895, 1017, 0])
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
    // 원본 코드 3 [55, 700, 200] — 낮게 깔린 타구라 낙구(8) 전엔 보통 포구가 없고, 슬라이딩 창이 열리면 1루수가 6틱에 몸을 던진다
    const 궤적 = battedBallTrajectory([55, 700, 200, 0])
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

/**
 * 복제 틱 루프 0xb12d0 의 n · 동작 잠금 · +0x127 (b13ec · b1416 · b146c · b148e · b17fc).
 * 손으로 만든 궤적 — 중견수(8)만 낮은 공 창이 열리게 `onlySlot` 을 준다(+0x1e8 모드, 다른 야수는 A · B 가 닫힌다).
 */
describe('예보 복제의 n — 판정받은 틱만 센다 (0xb12d0 직접 뜸)', () => {
  const 중견 = FIELDER_START_POSITIONS[8]
  /** 중견수에게서 z 로 300 + 220 × 6 떨어진 땅 위의 멈춘 공 — n = 6 이면 외야 반경 300 안 */
  const 멈춘공 = {
    length: 1,
    pointAt: () => ({ x: 중견.x, y: 0, z: 중견.z - (300 + 220 * 6) }),
    landingTick: 0,
    fenceTick: -1,
    poleTick: -1,
    startedAtPlate: false,
  }
  const 전구간 = { from: 0, to: Number.POSITIVE_INFINITY }

  it('보통 야수는 t 틱째에 n = t — 6틱에 닿는다', () => {
    expect(forecastCatch(멈춘공, 야수들, 전구간, { onlySlot: 8 }).table.low).toEqual({ tick: 6, slot: 8 })
  })

  it('추적야수(+0x130)가 건너뛴 4틱(b13ec)은 n 에 안 든다 — n++(b1452)보다 앞이라 10틱에 닿는다', () => {
    expect(forecastCatch(멈춘공, 야수들, 전구간, { onlySlot: 8, initialChaserSlot: 8 }).table.low).toEqual({ tick: 10, slot: 8 })
  })

  it('동작 잠금 +0xb4 를 복제가 물려받는다 — 잠긴 틱은 판정 없이 n 을 되돌리고(b148e) 복제 틱이 잠금을 하나씩 푼다', () => {
    const 잠긴 = 야수들.map((야수) => (야수.slot === 8 ? { ...야수, actionLockTicks: 5 } : 야수))
    expect(forecastCatch(멈춘공, 잠긴, 전구간, { onlySlot: 8 }).table.low).toEqual({ tick: 11, slot: 8 })
    // 0xb3b38 의 가까운 야수(0xb3c4c)도 잠긴 야수는 건너뛴다
    expect(nearestSlotTo(잠긴, 중견)).not.toBe(8)
  })

  it('+0x127 이면 낙구 틱까지 복제가 낙구 지점으로 실제로 달리고(b1416 vt14) n 은 낙구 뒤부터 센다', () => {
    // 10틱까지 중견수 뒤 5000 위로 높이 3000(못 잡음) · 낙구 뒤엔 중견수 옆 600 에 멈춘 공
    const 공 = {
      length: 20,
      pointAt: (tick: number) =>
        tick <= 10 ? { x: 중견.x, y: tick === 10 ? 0 : 3000, z: 중견.z + 5000 } : { x: 중견.x + 600, y: 0, z: 중견.z },
      landingTick: 10,
      fenceTick: -1,
      poleTick: -1,
      startedAtPlate: false,
    }
    // 보통은 11틱에 n = 11 이라 곧바로 닿는다
    expect(forecastCatch(공, 야수들, { from: 11, to: Number.POSITIVE_INFINITY }, { onlySlot: 8 }).table.low).toEqual({ tick: 11, slot: 8 })
    // +0x127: 10틱 동안 2200 을 낙구 지점 쪽으로 달려 거리 isqrt(600² + 2200²) = 2280 · n 은 11틱에 1 → 2280 − 220n ≤ 300 은 n = 9
    expect(
      forecastCatch(공, 야수들, { from: 11, to: Number.POSITIVE_INFINITY }, { onlySlot: 8, chaseToLanding: true }).table.low,
    ).toEqual({ tick: 19, slot: 8 })
  })
})
