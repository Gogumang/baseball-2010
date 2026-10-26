import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { applySalaryChange } from '@/entities/career/model/seasonFlow'
import type { SalaryHolder } from '@/entities/career/model/seasonFlow'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 인기도 상승 0 → 상승분 1, base = 65000 + 1, 변동률 30% (코드 0) → 84501 */
const 큰연봉: SalaryHolder = { popularity: 0, popularityAtSeasonStart: 0, salary: 65000 }

describe('B-69 연봉 u16 감김', () => {
  it('원본: 65536 을 넘으면 아래 16비트만 남는다', () => {
    const next = applySalaryChange(큰연봉, 0)
    expect(next.salary).toBe(84501 & 0xffff)
    expect(next.salaryRecordGrade).toBe(0xff)
  })

  it('고침: 65535 에 붙는다 — 작은 연봉은 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-69']))
    expect(applySalaryChange(큰연봉, 0).salary).toBe(65535)
    expect(applySalaryChange({ ...큰연봉, salary: 100 }, 0).salary).toBe(101 + 30)
  })
})
