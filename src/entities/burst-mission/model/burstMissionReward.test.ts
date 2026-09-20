import { describe, expect, it } from 'vitest'
import {
  BURST_REWARD_KIND,
  applyBurstRewards,
  burstRewardDeltasOf,
} from '@/entities/burst-mission/model/burstMissionReward'
import { 행 } from '@/entities/burst-mission/model/burstMissionTestRows'
import { BALANCE } from '@/shared/config/original/balance'

const 보상행 = 행({
  // 타자 표 3행 모양: 성공 소지금+4, 인기도+4 / 실패 페널티 없음
  successRewards: [
    { kind: BURST_REWARD_KIND.소지금, amount: 4 },
    { kind: BURST_REWARD_KIND.인기도, amount: 4 },
  ],
  failurePenalty: { kind: 0, amount: 0 },
})

const 페널티행 = 행({
  successRewards: [
    { kind: BURST_REWARD_KIND.사기, amount: 3 },
    { kind: BURST_REWARD_KIND.평판, amount: 3 },
  ],
  failurePenalty: { kind: BURST_REWARD_KIND.평판, amount: 3 },
})

const 기본값 = { morale: 50, popularity: 100, reputation: 300, money: 6000 }

describe('보상·페널티 고르기 (0x8e34c)', () => {
  it('성공이면 (b10,b11)·(b12,b13) 두 개를 더한다', () => {
    expect(burstRewardDeltasOf(보상행, '성공')).toEqual([
      { name: '소지금', amount: 4 },
      { name: '인기도', amount: 4 },
    ])
  })

  it('실패면 (b14,b15) 하나를 뺀다', () => {
    expect(burstRewardDeltasOf(페널티행, '실패')).toEqual([{ name: '평판', amount: -3 }])
  })

  it('b14 == 0 이면 실패해도 아무 일이 없다', () => {
    expect(burstRewardDeltasOf(보상행, '실패')).toEqual([])
  })

  it('무효면 보상도 페널티도 없다', () => {
    expect(burstRewardDeltasOf(페널티행, '무효')).toEqual([])
  })
})

describe('보상 붙이기', () => {
  it('종류 1 사기 · 2 인기도 · 3 평판 · 4 소지금 (0x8e3ae)', () => {
    expect(BURST_REWARD_KIND).toEqual({ 사기: 1, 인기도: 2, 평판: 3, 소지금: 4 })
  })

  it('소지금 한 칸은 100만원이라 웹 단위(만원)로 100 을 곱한다', () => {
    const 결과 = applyBurstRewards(기본값, burstRewardDeltasOf(보상행, '성공'))

    expect(결과.money).toBe(6000 + 4 * BALANCE.money.unit)
    expect(결과.popularity).toBe(104)
  })

  it('사기·평판도 그대로 더한다', () => {
    const 결과 = applyBurstRewards(기본값, burstRewardDeltasOf(페널티행, '성공'))

    expect(결과.morale).toBe(53)
    expect(결과.reputation).toBe(303)
  })

  it('실패 페널티는 빼고, 0 아래로는 내려가지 않는다', () => {
    const 결과 = applyBurstRewards({ ...기본값, reputation: 1 }, burstRewardDeltasOf(페널티행, '실패'))

    expect(결과.reputation).toBe(0)
  })

  it('상한에서 멈춘다 — 사기 100 · 인기도 9999 · 평판 999 · 소지금 9999칸', () => {
    const 꽉찬값 = {
      morale: BALANCE.limits.morale,
      popularity: BALANCE.limits.popularity,
      reputation: BALANCE.limits.reputation,
      money: BALANCE.limits.moneyUnits * BALANCE.money.unit,
    }
    const 결과 = applyBurstRewards(꽉찬값, [
      { name: '사기', amount: 5 },
      { name: '인기도', amount: 5 },
      { name: '평판', amount: 5 },
      { name: '소지금', amount: 5 },
    ])

    expect(결과).toEqual(꽉찬값)
  })

  it('종류 0(없음)은 건너뛴다', () => {
    const row = 행({ successRewards: [{ kind: 0, amount: 9 }, { kind: BURST_REWARD_KIND.사기, amount: 5 }] })

    expect(burstRewardDeltasOf(row, '성공')).toEqual([{ name: '사기', amount: 5 }])
  })
})
