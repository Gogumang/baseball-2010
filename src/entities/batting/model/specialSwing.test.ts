import { describe, expect, it } from 'vitest'
import {
  ACE_BATTER_SPECIAL_SWING_PERCENT,
  SPECIAL_SWING_PERCENTS,
  canSpecialSwing,
  remainingAfterSpecialSwing,
  rollSpecialSwing,
  specialSwingCountOf,
  specialSwingPercentOf,
} from '@/entities/batting/model/specialSwing'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'

/** 필살타법 성공 판정 (0x34c74 → 0x517e6 — H2 2-2 확정) */

const 고정난수 = (value: number): RandomPort => createConstantRandom(value)

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

describe('한 경기 횟수 — 표 0xd84f0 · 0xd84fa (0xaebe4)', () => {
  it('육성·일반 타자는 번호별 2·3·4·5, 번호 0 이면 0', () => {
    expect([0, 1, 2, 3, 4].map((swingNumber) => specialSwingCountOf({ swingNumber, isAceBatter: false }))).toEqual([0, 2, 3, 4, 5])
  })

  it('마타자는 레벨별 2·2·3·4·5 (번호 5~9 와 무관)', () => {
    expect([0, 1, 2, 3, 4].map((aceLevel) => specialSwingCountOf({ swingNumber: 7, isAceBatter: true, aceLevel }))).toEqual([2, 2, 3, 4, 5])
  })

  it('스킬 23 무자비는 +1', () => {
    expect(specialSwingCountOf({ swingNumber: 4, isAceBatter: false, hasRuthlessSkill: true })).toBe(6)
    expect(specialSwingCountOf({ swingNumber: 0, isAceBatter: false, hasRuthlessSkill: true })).toBe(0)
  })
})

describe("'0' 키 가드 0x51e14 · 소모 0x4e136", () => {
  it('남은 횟수 0 이면 무시, 음수(안 채움)는 통과, 모르면 번호만 본다', () => {
    expect(canSpecialSwing(2, false, 0)).toBe(false)
    expect(canSpecialSwing(2, false, 1)).toBe(true)
    expect(canSpecialSwing(2, false, -1)).toBe(true)
    expect(canSpecialSwing(2, false)).toBe(true)
    expect(canSpecialSwing(0, false)).toBe(false)
    expect(canSpecialSwing(0, true, 3)).toBe(true)
  })

  it('양수일 때만 1 줄인다', () => {
    expect([3, 1, 0, -1].map(remainingAfterSpecialSwing)).toEqual([2, 0, 0, -1])
  })
})
