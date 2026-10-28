import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { autoSlideRunnerIndexes } from '@/entities/defense-controls/model/sliding'
import type { SlidingRunner } from '@/entities/defense-controls/model/sliding'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 3루에서 홈으로 뛰는 주자 — 4틱 뒤 홈에 닿는다 */
const 홈주자: SlidingRunner = {
  progressPercent: 80,
  isOut: false,
  isLeavingField: false,
  isSliding: false,
  targetBase: 4,
  ticksToArrive: 4,
}

const 홈송구 = (runners: readonly SlidingRunner[]) =>
  autoSlideRunnerIndexes({ isThrowInFlight: true, throwTargetBase: 0, throwArrivalTicks: 5, runners })

describe('B-57 홈 송구에는 자동 슬라이딩이 안 걸린다', () => {
  it('원본: 주자 목표 4 와 송구 목표 0 이 달라 안 걸린다', () => {
    expect(홈송구([홈주자])).toEqual([])
  })

  it('고침: 주자의 홈(4)을 0 으로 읽어 걸린다 — 다른 루 송구에는 여전히 안 걸린다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-57']))
    expect(홈송구([홈주자])).toEqual([0])
    expect(autoSlideRunnerIndexes({ isThrowInFlight: true, throwTargetBase: 3, throwArrivalTicks: 5, runners: [홈주자] })).toEqual([])
  })
})
