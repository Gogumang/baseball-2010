import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { OWN_POSITION_RECORDS_BUGFIX_ID, isDefenseSideRecord, ownPositionRecordIdsOf } from '@/entities/game/model/ownPositionRecords'
import { passesRecordTeamGate } from '@/entities/game/model/gameRecords'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 모든기록 = Array.from({ length: 40 }, (_, id) => id)
const 수비쪽 = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 36]

describe('자기 포지션 기록 거름 (B-129)', () => {
  it('수비 쪽은 0xa77f0 a78bc 의 범위(16~31 · 36)다', () => {
    expect(모든기록.filter(isDefenseSideRecord)).toEqual(수비쪽)
    // 게이트를 건너뛰는 28~31 · 37~39 를 빼면 사람 수비 게이트를 지나는 번호와 같다
    const 수비게이트 = 모든기록.filter((id) => passesRecordTeamGate(id, { offenseIsHuman: false, defenseIsHuman: true }))
    expect(수비게이트.filter((id) => id < 37)).toEqual(수비쪽)
  })

  it('원본 길(기본 시험 모드)은 아무것도 거르지 않는다', () => {
    expect(ownPositionRecordIdsOf(모든기록, 'batter')).toEqual(모든기록)
    expect(ownPositionRecordIdsOf(모든기록, 'pitcher')).toEqual(모든기록)
  })

  it('고친 길은 타자에게 공격 쪽만, 투수에게 수비 쪽만 남긴다', () => {
    setBugfixConfigForTests(bugfixConfigWith([OWN_POSITION_RECORDS_BUGFIX_ID]))
    expect(ownPositionRecordIdsOf(모든기록, 'pitcher')).toEqual(수비쪽)
    expect(ownPositionRecordIdsOf(모든기록, 'batter')).toEqual(모든기록.filter((id) => !수비쪽.includes(id)))
  })
})
