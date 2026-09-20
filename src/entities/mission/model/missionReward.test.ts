import { describe, expect, it } from 'vitest'
import { missionRewardOf, missionRewardTierOf } from '@/entities/mission/model/missionReward'
import { MISSIONS } from '@/shared/config/original/missions'

describe('미션 보상 등급 — (byte1 >> 1) & 7', () => {
  it('원본 값 2·4·6·8·10 이 등급 1~5 가 된다', () => {
    expect([2, 4, 6, 8, 10].map(missionRewardTierOf)).toEqual([1, 2, 3, 4, 5])
  })

  it('마선수 공략(byte1 = 0)은 등급이 0 이라 보상이 없다', () => {
    expect(missionRewardTierOf(0)).toBe(0)
    expect(missionRewardOf(0, 0)).toBe(0)
  })
})

describe('미션 보상 G — 0xa52b0 (다시 깰수록 줄어든다)', () => {
  it('등급별 첫 클리어는 500·1000·1500·2000·2500', () => {
    expect([2, 4, 6, 8, 10].map((stage) => missionRewardOf(stage, 0))).toEqual([500, 1000, 1500, 2000, 2500])
  })

  it('등급 1 의 구간별 보상 — 500 / 300 / 200 / 100 / 50', () => {
    expect([0, 1, 4, 5, 9, 10, 19, 20, 50].map((n) => missionRewardOf(2, n)))
      .toEqual([500, 300, 300, 200, 200, 100, 100, 50, 50])
  })

  it('등급 5 의 구간별 보상 — 2500 / 1500 / 1000 / 500 / 250', () => {
    expect([0, 1, 5, 10, 20].map((n) => missionRewardOf(10, n))).toEqual([2500, 1500, 1000, 500, 250])
  })

  it('나눗셈은 0 쪽으로 버린다 — 등급 3 의 6~10회째는 600 이다', () => {
    // (3*3 & 0xf) * 200 / 3 = 9 * 200 / 3 = 600
    expect(missionRewardOf(6, 5)).toBe(600)
  })

  it('원본 미션 표의 stage 가 세 개마다 한 등급씩 오른다', () => {
    const 타자미션 = MISSIONS.filter((mission) => mission.side === '타자' && mission.id <= 12)
    expect(타자미션.map((mission) => missionRewardTierOf(mission.stage))).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4])
  })
})
