// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStorageMissionRecord } from '@/shared/api/save/localStorageMissionRecord'

const STORAGE_KEY = 'compus-baseball/mission-cleared'

describe('미션 클리어 기록 저장 — 횟수를 센다 (0xa51d0)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('저장한 횟수를 그대로 돌려준다', () => {
    const record = createLocalStorageMissionRecord()
    record.save({ '타자:1': 3, '투수:2': 1 })

    expect(createLocalStorageMissionRecord().load()).toEqual({ '타자:1': 3, '투수:2': 1 })
  })

  it('예전 형식(클리어한 키 배열)은 각 키를 1회 클리어로 읽는다', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['타자:1', '타자:2']))

    expect(createLocalStorageMissionRecord().load()).toEqual({ '타자:1': 1, '타자:2': 1 })
  })

  it('저장된 값이 없거나 깨졌으면 빈 기록이다', () => {
    expect(createLocalStorageMissionRecord().load()).toEqual({})
    window.localStorage.setItem(STORAGE_KEY, '{망가진 JSON')
    expect(createLocalStorageMissionRecord().load()).toEqual({})
  })

  it('0 이하나 숫자가 아닌 값은 버리고, 99 를 넘으면 99 로 자른다', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ '타자:1': 0, '타자:2': '셋', '타자:3': 120, '타자:4': 2 }),
    )

    expect(createLocalStorageMissionRecord().load()).toEqual({ '타자:3': 99, '타자:4': 2 })
  })
})
