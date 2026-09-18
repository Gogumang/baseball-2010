import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { battingOrderEventId, emptyPlaceEventId } from '@/entities/career/model/battingOrder'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })

describe('타순 — 0xa4c2c · 표 0xd7e30~0xd7e80', () => {
  it('신인은 9번 타자로 시작한다', () => {
    expect(선수().battingOrder).toBe(9)
  })

  it('평판 200 이상이면 8번으로 올리는 470', () => {
    expect(battingOrderEventId(선수({ reputation: 199 }))).toBeNull()
    expect(battingOrderEventId(선수({ reputation: 200 }))).toBe(470)
  })

  it('6번 다음은 경로를 따른다 — 고르기 전에는 원본 기본값(4번 경로)', () => {
    expect(battingOrderEventId(선수({ battingOrder: 6, reputation: 600 }))).toBe(476)
    expect(battingOrderEventId(선수({ battingOrder: 6, reputation: 600, battingOrderPath: '4번' }))).toBe(476)
    expect(battingOrderEventId(선수({ battingOrder: 6, reputation: 600, battingOrderPath: '1번' }))).toBe(473)
  })

  it('끝까지 오르면 4번(478) 또는 1번(475)', () => {
    expect(battingOrderEventId(선수({ battingOrder: 3, reputation: 900, battingOrderPath: '4번' }))).toBe(478)
    expect(battingOrderEventId(선수({ battingOrder: 3, reputation: 900, battingOrderPath: '1번' }))).toBe(475)
  })

  it('평판이 기준 아래로 떨어지면 강등 이벤트', () => {
    expect(battingOrderEventId(선수({ battingOrder: 8, reputation: 149 }))).toBe(479)
    expect(battingOrderEventId(선수({ battingOrder: 4, reputation: 824, battingOrderPath: '4번' }))).toBe(486)
    expect(battingOrderEventId(선수({ battingOrder: 1, reputation: 824, battingOrderPath: '1번' }))).toBe(484)
  })

  it('기준 사이면 그대로다', () => {
    expect(battingOrderEventId(선수({ battingOrder: 8, reputation: 180 }))).toBeNull()
  })
})

describe('외출 빈 장소 — 0x16ccc', () => {
  it('이벤트가 없는 장소는 440 + 장소 순번(프레임 − 1)', () => {
    expect([1, 2, 3, 4, 5].map(emptyPlaceEventId)).toEqual([440, 441, 442, 443, 444])
  })
})
