import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { humanSwingTimingOf, timingOf } from '@/entities/batting/model/swingTiming'

/** 직구 N = 14 의 F = N − 4 .. N 타이밍 */
const 직구 = 14
const 창 = (timing: typeof timingOf) => [10, 11, 12, 13, 14].map((frame) => timing(frame, 직구, false))

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-130 사람 타자 타이밍 폭', () => {
  it('원본 길은 timingOf 그대로 — 37 / 70 / 100 / 70 / 37', () => {
    expect(창(humanSwingTimingOf)).toEqual([37, 70, 100, 70, 37])
    expect(창(humanSwingTimingOf)).toEqual(창(timingOf))
  })

  it('고친 길은 폭 24 → 36 — 최적 100 은 같고 한 틱 70 → 80 · 두 틱 37 → 58', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-130']))
    expect(창(humanSwingTimingOf)).toEqual([58, 80, 100, 80, 58])
  })

  it('고친 길의 마구는 폭 22 → 33 (나눔 12 그대로)', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-130']))
    expect(humanSwingTimingOf(29, 30, true)).toBe(Math.trunc((100 * (33 - Math.trunc(100 / 12))) / 33))
  })

  it('CPU 타자가 쓰는 timingOf 는 고친 길에서도 원본 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-130']))
    expect(창(timingOf)).toEqual([37, 70, 100, 70, 37])
  })
})
