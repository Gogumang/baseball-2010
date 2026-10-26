import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { rewardNoticeOf } from '@/entities/story/model/rewardNotice'
import type { RewardNoticeContext } from '@/entities/story/model/rewardNotice'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 맥락: RewardNoticeContext = { mode: 4, years: 0, illness: 0, salaryBase: 100, random: createFractionRandom(() => 0) }
const 글 = (value: number) => rewardNoticeOf([{ kind: 3, value }], 1, 맥락).notice

describe('B-78 소지금이 줄 때도 부호 없이 "N만"', () => {
  it('원본: −5 는 "소지금 500만"', () => {
    expect(글(-5)).toMatchObject({ text: '!C소지금 500만' })
  })

  it('고침: −5 는 "소지금 -500만"(다른 종류 " -3" 과 같은 꼴) — 늘 때는 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-78']))
    expect(글(-5)).toMatchObject({ text: '!C소지금 -500만' })
    expect(글(-150)).toMatchObject({ text: '!C소지금 -1억5000만' })
    expect(글(10)).toMatchObject({ text: '!C소지금 + 1000만' })
  })
})
