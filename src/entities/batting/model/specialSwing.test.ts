import { describe, expect, it } from 'vitest'
import {
  ACE_BATTER_SPECIAL_SWING_PERCENT,
  SPECIAL_SWING_PERCENTS,
  rollSpecialSwing,
  specialSwingPercentOf,
} from '@/entities/batting/model/specialSwing'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 필살타법 성공 판정 (0x34c74 → 0x517e6 — H2 2-2 확정) */

const 고정난수 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
})

describe('성공 확률 표 0xcfdbe', () => {
  it('번호 1~5 가 15·20·25·25·30 % 다 (색인 = 번호 − 1, 0x34cb0)', () => {
    expect(SPECIAL_SWING_PERCENTS).toEqual([15, 20, 25, 25, 30])
    expect([1, 2, 3, 4, 5].map((swingNumber) => specialSwingPercentOf(swingNumber))).toEqual([15, 20, 25, 25, 30])
  })

  it('확률은 레벨이 아니라 고른 번호(+0x18)로 정한다 — 넷 다 배우고 파워 스윙(1)을 고르면 15 %', () => {
    // 예전엔 레벨 4 를 넘겨 25 % 가 걸렸다
    expect(specialSwingPercentOf(1)).toBe(15)
  })

  it('장타형 메테오 스윙도 저장 번호는 4 라 넷째 값 25 % 다 — 다섯째 30 은 안 쓰인다', () => {
    expect(specialSwingPercentOf(4)).toBe(25)
  })

  it('마타자는 번호와 무관하게 30 % 다', () => {
    expect(ACE_BATTER_SPECIAL_SWING_PERCENT).toBe(30)
    expect(specialSwingPercentOf(1, true)).toBe(30)
    expect(specialSwingPercentOf(0, true)).toBe(30)
  })

  it('번호 0(안 고름)은 0 % 라 굴려도 늘 실패다', () => {
    expect(specialSwingPercentOf(0)).toBe(0)
    expect(rollSpecialSwing(0, 고정난수(0))).toBe(false)
  })

  it('번호가 표보다 커도 마지막 칸으로 자른다', () => {
    expect(specialSwingPercentOf(9)).toBe(30)
  })
})

describe('굴림 — `p·10 > rand(0, 1000)`', () => {
  it('난수가 0 이면 확률이 있는 한 성공한다', () => {
    expect(rollSpecialSwing(1, 고정난수(0))).toBe(true)
  })

  it('난수가 문턱과 같으면 실패다 (초과여야 성공)', () => {
    // 번호 1 = 15 % → 문턱 150
    expect(rollSpecialSwing(1, 고정난수(150 / 1000))).toBe(false)
    expect(rollSpecialSwing(1, 고정난수(149 / 1000))).toBe(true)
  })

  it('레벨이 높을수록 문턱이 높다 — 레벨 1 이 실패하는 난수로 레벨 5 는 성공한다', () => {
    const 난수 = 고정난수(200 / 1000)
    expect(rollSpecialSwing(1, 난수)).toBe(false)
    expect(rollSpecialSwing(5, 고정난수(200 / 1000))).toBe(true)
  })
})
