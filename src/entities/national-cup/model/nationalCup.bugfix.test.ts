import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { coinFlipChampion, createNationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import {
  CAREER_NATIONAL_CUP_RUNNER_UP_REWARD,
  careerNationalCupRewardItems,
  finishNationalCup,
  nationalCupResultText,
  nationalCupRewardText,
} from '@/entities/national-cup/model/nationalCupFlow'
import type { RandomPort } from '@/shared/api/random/randomPort'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 켜기 = (id: string) => setBugfixConfigForTests(bugfixConfigWith([id]))

/** rand 를 몇 번 불렀는지 세고 늘 lo 를 준다 */
const 세는난수 = () => {
  const 기록 = { calls: 0 }
  const random: RandomPort = {
    rand: (lo) => {
      기록.calls += 1
      return lo
    },
    rand9d: () => 0,
  }
  return { random, 기록 }
}

const 결승날 = (finalists: readonly [number, number], champion = 15): NationalCup => ({
  ...createNationalCup(),
  stage: 1,
  finalists,
  champion,
})

describe('B-41 대한민국이 결승에 못 가면 동전 던지기로 우승국', () => {
  it('원본: rand(0,2) == 0 이면 2위가 우승', () => {
    const { random, 기록 } = 세는난수()
    expect(coinFlipChampion(결승날([12, 13]), random).champion).toBe(13)
    expect(기록.calls).toBe(1)
  })

  it('고침: 풀리그 1위가 우승 — 동전은 그대로 한 번 굴려 난수 차례가 같다', () => {
    켜기('B-41')
    const { random, 기록 } = 세는난수()
    expect(coinFlipChampion(결승날([12, 13]), random).champion).toBe(12)
    expect(기록.calls).toBe(1)
  })
})

describe('B-42 결승에서 져도 "대표팀 탈락!!"', () => {
  it('원본: 준우승이라는 말이 없다', () => {
    expect(nationalCupResultText(2, false, '일본', true)).toContain('탈락')
  })

  it('고침: 결승에서 진 해는 "준우승" — 결승에 못 간 해는 그대로 "탈락"', () => {
    켜기('B-42')
    const 준우승 = nationalCupResultText(2, false, '일본', true)
    expect(준우승).toContain('대표팀 준우승!!')
    expect(준우승).not.toContain('탈락')
    expect(nationalCupResultText(2, false, '일본', false)).toContain('탈락')
  })
})

describe('B-44 나만의리그에는 준우승 보상이 없다', () => {
  const 결승패 = 결승날([10, 11], 11)

  it('원본: 결승에서 져도 빈손', () => {
    expect(finishNationalCup('나만의리그', 결승패).reward.messageId).toBe(0)
  })

  it('고침: 나리 우승 값의 절반(인기도 10 · 평판 15 · 1000만) · 글 StrMODE[200]', () => {
    켜기('B-44')
    const reward = finishNationalCup('나만의리그', 결승패).reward
    expect(reward).toEqual(CAREER_NATIONAL_CUP_RUNNER_UP_REWARD)
    expect(careerNationalCupRewardItems(reward)).toEqual([
      { kind: 0, value: 10 },
      { kind: 1, value: 15 },
      { kind: 3, value: 10 },
      { kind: 10, value: 0 },
    ])
    expect(nationalCupRewardText(reward)).toContain('1000만')
    // 결승에 못 간 해 · 우승은 그대로
    expect(finishNationalCup('나만의리그', 결승날([11, 12], 11)).reward.messageId).toBe(0)
    expect(finishNationalCup('나만의리그', 결승날([10, 11], 10)).reward.messageId).toBe(199)
  })
})
