import { describe, expect, it } from 'vitest'
import {
  EMPTY_COLLECTION,
  HALL_OF_FAME_COST,
  HALL_OF_FAME_MAX_BATTERS,
  HALL_OF_FAME_MAX_PITCHERS,
  HALL_OF_FAME_OPEN_BATTERS,
  HALL_OF_FAME_OPEN_PITCHERS,
  firstEmptyHallOfFameSlot,
  hallOfFameBatterAt,
  registerHallOfFamePitcher,
  mergeCareerIntoCollection,
  mergeEndingIntoCollection,
  normalizeCollection,
  openHiddenForMissions,
  registerHallOfFame,
} from '@/entities/collection/model/collection'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

const 선수 = (overrides = {}) => ({ ...createCareer('전설'), ...overrides })

describe('기록연감 — 모은 닉네임·스킬·엔딩 (StrHOWTO[28])', () => {
  it('커리어가 얻은 것을 합치고 중복은 없앤다', () => {
    const once = mergeCareerIntoCollection(EMPTY_COLLECTION, 선수({ titleIds: ['이름 없는 신인'], skillIds: [2], endingIndex: 5 }))
    const twice = mergeCareerIntoCollection(once, 선수({ titleIds: ['이름 없는 신인', '안타제조기'], skillIds: [2, 7] }))

    expect(twice.titles).toEqual(['이름 없는 신인', '안타제조기'])
    expect(twice.skills).toEqual([2, 7])
    // 본 엔딩 5 에 연애 엔딩 10(짝 없음 — 본 연애 이벤트 0)이 같이 켜진다 (0x87c7c)
    expect(twice.endings).toEqual([5, 10])
  })

  it('저장값이 깨졌으면 빈 기록연감이다', () => {
    expect(normalizeCollection({ titles: 3 })).toEqual(EMPTY_COLLECTION)
    expect(normalizeCollection(null)).toEqual(EMPTY_COLLECTION)
  })

  it('명예의 전당 항목 중 형식이 깨진 것만 버린다', () => {
    const famer = { name: '전설', ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [] }
    const raw = { titles: [], skills: [], endings: [], hallOfFame: [famer, { name: 3 }, null] }

    expect(normalizeCollection(raw).hallOfFame).toEqual([{ ...famer, slot: 0 }])
  })
})

describe('엔딩 칸 — 엔딩 적재 0x87c7c', () => {
  it('본 엔딩과 연애 엔딩 9 + c 를 켜고, 부상·방출엔 연애 엔딩이 없다', () => {
    expect(mergeEndingIntoCollection(EMPTY_COLLECTION, { endingIndex: 7, seenEventIds: ['300', '302'] }).endings).toEqual([7, 12])
    expect(mergeEndingIntoCollection(EMPTY_COLLECTION, { endingIndex: 1, seenEventIds: ['300'] }).endings).toEqual([1])
    expect(mergeEndingIntoCollection(EMPTY_COLLECTION, { endingIndex: null, seenEventIds: [] })).toBe(EMPTY_COLLECTION)
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

describe('명예의 전당 — 등록 0x62cea (K 4-2 · Q2 4절)', () => {
  const 넉넉 = 99_999

  it('엔딩을 본 선수를 첫 빈 칸(0x62514)에 등록한다 — 장비 얹은 능력치·생김새를 같이 남긴다', () => {
    const result = registerHallOfFame(EMPTY_COLLECTION, 선수({ endingIndex: 6, season: 13, skinIndex: 2 }), 넉넉)

    expect(result.kind).toBe('등록')
    if (result.kind !== '등록') return
    expect(result.slot).toBe(0)
    expect(result.collection.hallOfFame[0]).toMatchObject({ name: '전설', endingIndex: 6, slot: 0, look: { skinIndex: 2 } })
    expect(result.collection.hallOfFame[0].equippedAbility).toBeDefined()
  })

  it('G 가 20000 이 안 되면(≤ 19999) G 부족 — 0x62d08', () => {
    expect(registerHallOfFame(EMPTY_COLLECTION, 선수({ endingIndex: 2 }), HALL_OF_FAME_COST - 1).kind).toBe('G부족')
    expect(registerHallOfFame(EMPTY_COLLECTION, 선수({ endingIndex: 2 }), HALL_OF_FAME_COST).kind).toBe('등록')
  })

  it('타자는 기본 4칸만 열려 있다 — 다 차면 StrCOMMON[51]', () => {
    let collection = EMPTY_COLLECTION
    for (let slot = 0; slot < HALL_OF_FAME_OPEN_BATTERS; slot += 1) {
      const result = registerHallOfFame(collection, 선수({ endingIndex: 2 }), 넉넉)
      if (result.kind === '등록') collection = result.collection
    }

    expect(collection.hallOfFame.map((famer) => famer.slot)).toEqual([0, 1, 2, 3])
    expect(firstEmptyHallOfFameSlot(collection, '타자')).toBeNull()
    expect(registerHallOfFame(collection, 선수({ endingIndex: 2 }), 넉넉).kind).toBe('빈칸없음')
    expect(HALL_OF_FAME_MAX_BATTERS).toBe(8)
  })

  it('고른 빈 칸에 넣는다 — 잠긴 칸·찬 칸은 안 된다', () => {
    const result = registerHallOfFame(EMPTY_COLLECTION, 선수({ endingIndex: 3 }), 넉넉, 2)
    expect(result.kind === '등록' && result.slot).toBe(2)
    if (result.kind !== '등록') return
    expect(hallOfFameBatterAt(result.collection, 2)?.endingIndex).toBe(3)
    expect(firstEmptyHallOfFameSlot(result.collection, '타자')).toBe(0)
    expect(registerHallOfFame(result.collection, 선수({ endingIndex: 3 }), 넉넉, 2).kind).toBe('빈칸없음')
    expect(registerHallOfFame(EMPTY_COLLECTION, 선수({ endingIndex: 3 }), 넉넉, 4).kind).toBe('빈칸없음')
  })

  it('투수는 +0x880 칸 — 기본 2칸 (0x1f654)', () => {
    const 투수 = { ...createPitcherCareer('철완'), endingIndex: 5 }
    let collection = EMPTY_COLLECTION
    for (let slot = 0; slot < HALL_OF_FAME_OPEN_PITCHERS; slot += 1) {
      const result = registerHallOfFamePitcher(collection, 투수, 넉넉)
      if (result.kind === '등록') collection = result.collection
    }
    expect(collection.hallOfFamePitchers.map((famer) => famer.slot)).toEqual([0, 1])
    expect(collection.hallOfFame).toEqual([])
    expect(registerHallOfFamePitcher(collection, 투수, 넉넉).kind).toBe('빈칸없음')
    expect(HALL_OF_FAME_MAX_PITCHERS).toBe(4)
  })

  it('엔딩을 보지 않은 선수는 등록할 수 없다', () => {
    expect(registerHallOfFame(EMPTY_COLLECTION, 선수(), 넉넉).kind).toBe('엔딩전')
  })

  it('옛 저장의 명예 선수는 목록 순서를 칸 번호로 굳힌다', () => {
    const famer = { name: '전설', ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [] }
    const loaded = normalizeCollection({ titles: [], skills: [], endings: [], hallOfFame: [famer, famer] })
    expect(loaded.hallOfFame.map((entry) => entry.slot)).toEqual([0, 1])
    expect(loaded.hallOfFamePitchers).toEqual([])
  })
})
