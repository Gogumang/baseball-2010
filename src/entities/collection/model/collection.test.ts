import { describe, expect, it } from 'vitest'
import {
  EMPTY_COLLECTION,
  HALL_OF_FAME_BATTER_SLOTS,
  mergeCareerIntoCollection,
  normalizeCollection,
  openHiddenForMissions,
  registerHallOfFame,
} from '@/entities/collection/model/collection'
import { createCareer } from '@/entities/career/model/playerCareer'

const 선수 = (overrides = {}) => ({ ...createCareer('전설'), ...overrides })

describe('기록연감 — 모은 닉네임·스킬·엔딩 (StrHOWTO[28])', () => {
  it('커리어가 얻은 것을 합치고 중복은 없앤다', () => {
    const once = mergeCareerIntoCollection(EMPTY_COLLECTION, 선수({ titleIds: ['이름 없는 신인'], skillIds: [2], endingIndex: 5 }))
    const twice = mergeCareerIntoCollection(once, 선수({ titleIds: ['이름 없는 신인', '안타제조기'], skillIds: [2, 7] }))

    expect(twice.titles).toEqual(['이름 없는 신인', '안타제조기'])
    expect(twice.skills).toEqual([2, 7])
    expect(twice.endings).toEqual([5])
  })

  it('저장값이 깨졌으면 빈 기록연감이다', () => {
    expect(normalizeCollection({ titles: 3 })).toEqual(EMPTY_COLLECTION)
    expect(normalizeCollection(null)).toEqual(EMPTY_COLLECTION)
  })

  it('명예의 전당 항목 중 형식이 깨진 것만 버린다', () => {
    const famer = { name: '전설', ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [] }
    const raw = { titles: [], skills: [], endings: [], hallOfFame: [famer, { name: 3 }, null] }

    expect(normalizeCollection(raw).hallOfFame).toEqual([famer])
  })
})

describe('히든 오픈 — 전역 기록 (game_o.sav)', () => {
  it('선수가 연 히든 id 를 모은다', () => {
    const merged = mergeCareerIntoCollection(EMPTY_COLLECTION, 선수({ openedHiddenIds: [36, 43] }))
    expect(merged.openedHiddenIds).toEqual([36, 43])
  })

  it('미션을 모두 깨면 헬멧 레벨 9(id 37)가 열린다 (0xa5184)', () => {
    expect(openHiddenForMissions(EMPTY_COLLECTION, true).openedHiddenIds).toEqual([37])
    expect(openHiddenForMissions(EMPTY_COLLECTION, false)).toBe(EMPTY_COLLECTION)
  })

  it('예전 기록에 필드가 없으면 빈 목록이다', () => {
    expect(normalizeCollection({ titles: [], skills: [], endings: [], hallOfFame: [] }).openedHiddenIds).toEqual([])
  })
})

describe('명예의 전당 — 타자 4칸', () => {
  it('엔딩을 본 선수를 등록한다', () => {
    const result = registerHallOfFame(EMPTY_COLLECTION, 선수({ endingIndex: 6, season: 13 }))

    expect(result.kind).toBe('등록')
    if (result.kind === '등록') expect(result.collection.hallOfFame[0]).toMatchObject({ name: '전설', endingIndex: 6 })
  })

  it('빈 칸이 없으면 거절한다 — StrCOMMON[51]', () => {
    let collection = EMPTY_COLLECTION
    for (let slot = 0; slot < HALL_OF_FAME_BATTER_SLOTS; slot += 1) {
      const result = registerHallOfFame(collection, 선수({ endingIndex: 2 }))
      if (result.kind === '등록') collection = result.collection
    }

    expect(registerHallOfFame(collection, 선수({ endingIndex: 2 })).kind).toBe('빈칸없음')
  })

  it('엔딩을 보지 않은 선수는 등록할 수 없다', () => {
    expect(registerHallOfFame(EMPTY_COLLECTION, 선수()).kind).toBe('엔딩전')
  })
})
