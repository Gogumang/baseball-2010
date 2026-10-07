import { describe, expect, it } from 'vitest'
import {
  deleteHallOfFame,
  hallOfFameEquipmentNibblesOf,
  syncHallOfFameEquipment,
  hallOfFameRecordIdOf,
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

  it('기록을 통째로 복사한다(0x1f680 · 0x1f654 memcpy 0x30) — 장비 니블·장착 비트 +0x14·번호 +0x18·구질 마스크 +0x1c', () => {
    const 타자 = 선수({
      endingIndex: 4, equipmentLevels: { hit: 3, power: 0, defense: 1, run: 0 }, equippedSkillIds: [5, 22], specialSwingNumber: 2,
    })
    const batter = registerHallOfFame(EMPTY_COLLECTION, 타자, 넉넉)
    if (batter.kind !== '등록') throw new Error('등록 실패')
    expect(batter.collection.hallOfFame[0]).toMatchObject({
      equipmentLevels: { hit: 3, power: 0, defense: 1, run: 0 }, equippedSkillIds: [5, 22], specialSwingNumber: 2,
    })

    const 투수 = {
      ...createPitcherCareer('철완'), endingIndex: 5, pitchMask: 0b1011, selectedMagicNumber: 3,
      equippedSkillIds: [16, 22], equipmentLevels: { control: 2, velocity: 0, breaking: 0, stamina: 4 },
    }
    const pitcher = registerHallOfFamePitcher(EMPTY_COLLECTION, 투수, 넉넉)
    if (pitcher.kind !== '등록') throw new Error('등록 실패')
    expect(pitcher.collection.hallOfFamePitchers[0]).toMatchObject({
      pitchMask: 0b1011, selectedMagicNumber: 3, equippedSkillIds: [16, 22],
      equipmentLevels: { control: 2, velocity: 0, breaking: 0, stamina: 4 },
    })
    // 저장했다 읽어도 그대로 남는다
    expect(normalizeCollection(JSON.parse(JSON.stringify(pitcher.collection))).hallOfFamePitchers).toEqual(pitcher.collection.hallOfFamePitchers)
    expect(normalizeCollection(JSON.parse(JSON.stringify(batter.collection))).hallOfFame).toEqual(batter.collection.hallOfFame)
  })

  it('투수 보직 +0xb & 3 은 등록 0x1f654 가 안 건드려 그대로 남는다 — 옛 저장은 칸 없음, 틀린 값은 버린다', () => {
    const 구원 = { ...createPitcherCareer('불펜'), endingIndex: 5, role: 2 as const }
    const result = registerHallOfFamePitcher(EMPTY_COLLECTION, 구원, 넉넉)
    if (result.kind !== '등록') throw new Error('등록 실패')
    expect(result.collection.hallOfFamePitchers[0]?.role).toBe(2)
    const saved = JSON.parse(JSON.stringify(result.collection)) as { hallOfFamePitchers: Record<string, unknown>[] }
    expect(normalizeCollection(saved).hallOfFamePitchers[0]?.role).toBe(2)

    const 옛 = { ...saved.hallOfFamePitchers[0] }
    delete 옛.role
    expect(normalizeCollection({ ...saved, hallOfFamePitchers: [옛] }).hallOfFamePitchers[0]?.role).toBeUndefined()
    expect(normalizeCollection({ ...saved, hallOfFamePitchers: [{ ...옛, role: 3 }] }).hallOfFamePitchers).toEqual([])
  })

  it('기록 칸이 없는 옛 저장도 읽고, 칸 형식이 깨진 선수만 버린다', () => {
    const famer = { name: '전설', ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [] }
    const loaded = normalizeCollection({
      titles: [], skills: [], endings: [], hallOfFame: [famer, { ...famer, equippedSkillIds: 'x' }, { ...famer, specialSwingNumber: '1' }],
    })
    expect(loaded.hallOfFame).toEqual([{ ...famer, slot: 0 }])
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

describe('명예의 전당 칸 삭제 — 0x22371 · 0x22339 (R11 3-2)', () => {
  const famer = (slot: number) => ({
    name: `타자${slot}`, ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [], slot,
  })

  it('그 칸만 빈 칸이 되고 다른 칸 번호는 그대로다 — 없는 칸이면 같은 객체', () => {
    const collection = { ...EMPTY_COLLECTION, hallOfFame: [famer(0), famer(2)] }

    const next = deleteHallOfFame(collection, '타자', 0)

    expect(next.hallOfFame.map((entry) => entry.slot)).toEqual([2])
    expect(deleteHallOfFame(collection, '타자', 1)).toBe(collection)
    expect(deleteHallOfFame(collection, '투수', 0)).toBe(collection)
  })

  it('기록 번호는 등록이 덮어쓴 칸 + 0xb4(투수) / + 0xc8(타자)', () => {
    expect(hallOfFameRecordIdOf('투수', 1)).toBe(0xb5)
    expect(hallOfFameRecordIdOf('타자', 3)).toBe(0xcb)
  })
})

describe('0x2328c — 시즌에서 명예 선수가 산 장비 니블을 명전 기록에도', () => {
  const famer = (slot: number) => ({
    name: `타자${slot}`, ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [], slot,
    equipmentLevels: { hit: 2, power: 0, defense: 0, run: 5 },
  })

  it('번호 0xc8 + 칸 의 타자 칸 니블 네 칸을 통째로 바꾼다 — 칸 t ↔ 히트·파워·수비·주루', () => {
    const collection = { ...EMPTY_COLLECTION, hallOfFame: [famer(0), famer(3)] }
    expect(hallOfFameEquipmentNibblesOf(collection, '타자', 0xcb)).toEqual([2, 0, 0, 5])
    const next = syncHallOfFameEquipment(collection, '타자', 0xcb, [2, 7, 0, 5])
    expect(next.hallOfFame[1]?.equipmentLevels).toEqual({ hit: 2, power: 7, defense: 0, run: 5 })
    expect(next.hallOfFame[0]?.equipmentLevels).toEqual({ hit: 2, power: 0, defense: 0, run: 5 })
  })

  it('맞는 칸이 없으면 같은 객체 (빈 칸 · 투수 쪽)', () => {
    const collection = { ...EMPTY_COLLECTION, hallOfFame: [famer(0)] }
    expect(syncHallOfFameEquipment(collection, '타자', 0xc9, [1, 1, 1, 1])).toBe(collection)
    expect(syncHallOfFameEquipment(collection, '투수', 0xb4, [1, 1, 1, 1])).toBe(collection)
  })
})
