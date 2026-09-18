import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { detailRowsOf, DETAIL_ROW_TOP } from '@/pages/management/lib/detailPopup'

const 선수 = createCareer('테스트')

describe('상세정보 결과 창 — 0x872a0 · 0x872d4', () => {
  it('히트·파워·수비·주루·사기 다섯 줄: 실효값 / 한계(사기 100) / 변화량', () => {
    const after = { ...선수, ability: { ...선수.ability, hit: 106 }, morale: 94 }

    expect(detailRowsOf(선수, after)).toEqual([
      { labelFrame: 336, current: 106, maximum: 800, change: 6 },
      { labelFrame: 337, current: 100, maximum: 800, change: 0 },
      { labelFrame: 338, current: 130, maximum: 800, change: 0 },
      { labelFrame: 339, current: 100, maximum: 800, change: 0 },
      { labelFrame: 84, current: 94, maximum: 100, change: -6 },
    ])
  })

  it('i 번째 줄 y = 76 + 17(i+1) − 4', () => {
    expect([0, 4].map(DETAIL_ROW_TOP)).toEqual([89, 157])
  })
})
