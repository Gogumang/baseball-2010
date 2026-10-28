import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { actedAfterOutingMapCancel, outingBlockReasonOf, performOuting, restBlockReasonOf, runRest } from '@/entities/career/model/outing'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), morale: 50, ...overrides })
const 입원 = OUTING_PLACES.flatMap((place) => place.functions).find((candidate) => candidate.name === '입원')!

describe('B-24 사기 100 이면 아파도 휴식 거절 (0x1261c)', () => {
  const 아픈 = 선수({ morale: 100, isInjured: true })

  it('원본: 사기 100 이면 다쳐도 거절', () => {
    expect(restBlockReasonOf(아픈)).toBe('사기최고')
  })

  it('고침: 다치거나 아프면 받는다 — 사기는 100 에서 잘리고 행동을 쓴다. 건강하면 여전히 거절', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-24']))
    expect(restBlockReasonOf(아픈)).toBeNull()
    expect(restBlockReasonOf(선수({ morale: 100, isSick: true }))).toBeNull()
    expect(restBlockReasonOf(선수({ morale: 100 }))).toBe('사기최고')
    const rest = runRest(아픈, createConstantRandom(0))
    expect(rest.career.morale).toBe(100)
    expect(rest.career.hasActedThisCycle).toBe(true)
  })
})

describe('B-25 입원 소지금 검사가 보험증서를 안 봄 (0x16d42)', () => {
  const 보험환자 = 선수({ money: 0, subItemIds: [7], isSick: true, illnessName: '감기', illnessRemaining: 3 })

  it('원본: 보험증서가 있어도 소지금이 모자라면 막는다', () => {
    expect(outingBlockReasonOf(보험환자, 입원)).toBe('소지금부족')
  })

  it('고침: 보험증서가 있으면 실제 비용 0 이라 들어간다 — 없으면 원본처럼 막는다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-25']))
    expect(outingBlockReasonOf(보험환자, 입원)).toBeNull()
    expect(performOuting(보험환자, 입원, createConstantRandom(0)).career.money).toBe(0)
    expect(outingBlockReasonOf({ ...보험환자, subItemIds: [] }, 입원)).toBe('소지금부족')
  })
})

describe('B-26 흑백 외출 칸 취소가 행동함을 내림 (0x13ba4 13bc0~13bca)', () => {
  it('원본: 취소는 늘 행동함을 내린다', () => {
    expect(actedAfterOutingMapCancel(true, true)).toBe(false)
    expect(actedAfterOutingMapCancel(true, false)).toBe(false)
  })

  it('고침: 들어설 때 값으로 — 이미 행동했으면 그대로, 진입 이벤트가 켠 것만 되돌린다. 모르면 지금 값', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-26']))
    expect(actedAfterOutingMapCancel(true, true)).toBe(true)
    expect(actedAfterOutingMapCancel(true, false)).toBe(false)
    expect(actedAfterOutingMapCancel(false, false)).toBe(false)
    expect(actedAfterOutingMapCancel(true, null)).toBe(true)
  })
})
