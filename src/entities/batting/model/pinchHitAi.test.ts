import { describe, expect, it } from 'vitest'
import {
  EMPTY_BATTER_GAME_RECORD,
  judgeCpuPinchHit,
  recordPlateAppearance,
} from '@/entities/batting/model/pinchHitAi'
import type { CpuPinchHitInput } from '@/entities/batting/model/pinchHitAi'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 정해진 값을 차례대로 내주는 난수 — 굴림 횟수도 센다 */
function 정해진난수(values: readonly number[]): RandomPort & { readonly rolls: number[] } {
  const rolls: number[] = []
  let index = 0
  return {
    rolls,
    rand(_minimum, maximum) {
      rolls.push(maximum)
      const value = values[index] ?? 0
      index += 1
      return Math.min(value, maximum - 1)
    },
    rand9d: () => 0,
  }
}

/** 모든 막는 조건을 지난 입력 — 주자 없음 = 100‰ */
const 통과입력: CpuPinchHitInput = {
  blockedUntilNextPitch: false,
  batterIsAce: false,
  benchBatters: 3,
  record: { hits: 0, homeRuns: 0, plateAppearances: 2 },
  runnerCount: 0,
  strikes: 0,
  balls: 0,
}

describe('CPU 대타 0xac228', () => {
  it('막는 조건을 다 지나고 굴림이 확률 밑이면 벤치 칸을 돌려준다', () => {
    const random = 정해진난수([99, 2])
    expect(judgeCpuPinchHit(통과입력, random)).toBe(2)
    // 굴림 둘 — rand(0,1000) 과 rand(0, 벤치수)
    expect(random.rolls).toEqual([1000, 3])
  })

  it('확률을 넘기면 벤치 굴림까지 가지 않는다 (ac322)', () => {
    const random = 정해진난수([100])
    expect(judgeCpuPinchHit(통과입력, random)).toBe(-1)
    expect(random.rolls).toEqual([1000])
  })

  it('주자 수가 확률을 정한다 — 0:100 1:200 2:300 만루:500 (ac2d2~ac2ec)', () => {
    const 확률 = (runnerCount: number): number => {
      // 굴림 값을 확률 경계로 올려 가며 참/거짓이 뒤집히는 자리를 찾는다
      for (let value = 0; value <= 1000; value += 1) {
        if (judgeCpuPinchHit({ ...통과입력, runnerCount }, 정해진난수([value, 0])) < 0) return value
      }
      return 1000
    }
    expect([확률(0), 확률(1), 확률(2), 확률(3)]).toEqual([100, 200, 300, 500])
  })

  it('안타가 하나면 확률이 반이다 (ac2fe)', () => {
    const 기록 = { hits: 1, homeRuns: 0, plateAppearances: 2 }
    expect(judgeCpuPinchHit({ ...통과입력, record: 기록 }, 정해진난수([49, 0]))).toBe(0)
    expect(judgeCpuPinchHit({ ...통과입력, record: 기록 }, 정해진난수([50, 0]))).toBe(-1)
  })

  it('볼카운트가 차 있으면 k+1 칸 오른쪽으로 민다 (ac302~ac312)', () => {
    // S1 B1 → k=2 → 100 >> 3 = 12
    const 입력 = { ...통과입력, strikes: 1, balls: 1 }
    expect(judgeCpuPinchHit(입력, 정해진난수([11, 0]))).toBe(0)
    expect(judgeCpuPinchHit(입력, 정해진난수([12, 0]))).toBe(-1)
  })

  it('막는 조건은 난수를 하나도 쓰지 않는다', () => {
    const 막힘: readonly Partial<CpuPinchHitInput>[] = [
      { blockedUntilNextPitch: true },
      { batterIsAce: true },
      { benchBatters: 0 },
      { record: { hits: 0, homeRuns: 1, plateAppearances: 2 } },
      { record: { hits: 2, homeRuns: 0, plateAppearances: 2 } },
      { record: { hits: 0, homeRuns: 0, plateAppearances: 1 } },
      { batterHasEquipment: true },
    ]
    for (const 덮개 of 막힘) {
      const random = 정해진난수([0, 0])
      expect(judgeCpuPinchHit({ ...통과입력, ...덮개 }, random)).toBe(-1)
      expect(random.rolls).toEqual([])
    }
  })
})

describe('타순 칸 기록 0xa8024', () => {
  it('타석 수는 안타든 아웃이든 오른다 (a8ac6 공통 꼬리)', () => {
    const 아웃 = recordPlateAppearance(EMPTY_BATTER_GAME_RECORD, {
      isHit: false,
      isHomeRun: false,
    })
    expect(아웃).toEqual({ hits: 0, homeRuns: 0, plateAppearances: 1 })
    const 안타 = recordPlateAppearance(아웃, { isHit: true, isHomeRun: false })
    expect(안타).toEqual({ hits: 1, homeRuns: 0, plateAppearances: 2 })
    const 홈런 = recordPlateAppearance(안타, { isHit: true, isHomeRun: true })
    expect(홈런).toEqual({ hits: 2, homeRuns: 1, plateAppearances: 3 })
  })

  it('+0x13 은 홈런 수다 — 점수 낸 안타(적시타)는 세지 않는다 (a874c 의 sp+0x24 = 홈런 이벤트 8)', () => {
    const 적시타 = recordPlateAppearance(EMPTY_BATTER_GAME_RECORD, { isHit: true, isHomeRun: false })
    expect(적시타.homeRuns).toBe(0)
    // 적시타가 있어도 대타를 막지 않는다 — 홈런이 막는다 (ac282)
    expect(judgeCpuPinchHit({ ...통과입력, record: { ...적시타, plateAppearances: 2 } }, 정해진난수([0, 0]))).toBe(0)
    const 홈런 = recordPlateAppearance(EMPTY_BATTER_GAME_RECORD, { isHit: true, isHomeRun: true })
    expect(judgeCpuPinchHit({ ...통과입력, record: { ...홈런, plateAppearances: 2 } }, 정해진난수([0, 0]))).toBe(-1)
  })

  it('견제(4)·주자만(5)으로 끝난 판은 타석 수를 안 올린다 — 0xa8024 의 state[0x26] 게이트', () => {
    const 한타석 = recordPlateAppearance(EMPTY_BATTER_GAME_RECORD, { isHit: false, isHomeRun: false })
    for (const playKind of [4, 5]) {
      expect(
        recordPlateAppearance(한타석, { isHit: false, isHomeRun: false, playKind }),
        `종류 ${playKind}`,
      ).toEqual(한타석)
    }
    // 종류를 안 주면 타구(1)다 — 지금까지와 똑같이 센다
    expect(recordPlateAppearance(한타석, { isHit: false, isHomeRun: false, playKind: 1 }).plateAppearances).toBe(2)
  })
})
