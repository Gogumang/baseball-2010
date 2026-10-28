import { describe, expect, it } from 'vitest'
import {
  SEASON_ENTRY_CELL_SOURCE,
  recordAceSeatOf,
  rotatedPitchersOf,
  seasonEntryListsOf,
  seasonRecordEntryListsOf,
  seasonEntryOrderOf,
  seasonRosterOfEntry,
  seasonStarterNameOf,
  tableRosterOf,
  unrotatedPitchersOf,
} from '@/entities/season-mode/model/seasonEntry'
import { swapEntryBatters, swapEntryPitchers } from '@/entities/season-mode/model/entryEditor'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { aceLevelSlotOf, aceRecordAbilityAtLevel } from '@/entities/mission/model/aceLevel'

/** 시즌 0xe0 이 보는 명단 — 시즌 세이브 명단 + 0x6548 이 넣은 마선수 + 로테이션 */

describe('시즌 엔트리 명단', () => {
  it('표 명단은 타자 수비 위치를 표에서 가져온다 — 아홉은 선발, 9~11 은 벤치(0)', () => {
    const roster = tableRosterOf(0)
    expect(roster.batters.map((p) => p.fieldPosition)).toEqual(teamBatters(0).map((p) => p.position ?? 0))
    expect(roster.batters.slice(0, 9).every((p) => p.fieldPosition !== 0)).toBe(true)
    expect(roster.pitchers).toHaveLength(8)
  })

  it('로테이션 g 번 = 투수 0~3 이 g 칸 당겨진 모양이고, 되돌리면 원래 배열이다 (0xb5ca8)', () => {
    const base = ['a', 'b', 'c', 'd', 'e']
    expect(rotatedPitchersOf(base, 1)).toEqual(['b', 'c', 'd', 'a', 'e'])
    expect(rotatedPitchersOf(base, 6)).toEqual(['c', 'd', 'a', 'b', 'e'])
    expect(unrotatedPitchersOf(rotatedPitchersOf(base, 3), 3)).toEqual(base)
  })

  it('마투수는 8번, 마타자는 9번에 앉고 옛 칸 선수는 맨 끝으로 간다 (0xb88c8 · 0xb8870)', () => {
    const lists = seasonEntryListsOf({ teamId: 0, roster: tableRosterOf(0), dayCounter: 0, acePitcherId: 1, aceBatterId: 2 })
    expect(lists.pitchers).toHaveLength(9)
    expect(lists.pitchers[8]).toMatchObject({ name: ACE_PITCHERS[1]?.name, isAce: true })
    expect(lists.batters).toHaveLength(13)
    expect(lists.batters[9]).toMatchObject({ name: ACE_BATTERS[2]?.name, isAce: true, position: 0 })
    expect(lists.batters[12]?.name).toBe(teamBatters(0)[9]?.name)
  })

  it('마선수 두 줄도 0xb6415(rec, k, 1) — 레벨 배율 · 장착 스킬 단계를 먹은 값이다 (표 값 그대로가 아니다)', () => {
    const 발렌타인 = ACE_PITCHERS.findIndex((ace) => ace.name === '발렌타인')
    const lv1 = seasonEntryListsOf({ teamId: 0, roster: tableRosterOf(0), dayCounter: 0, acePitcherId: 발렌타인, aceBatterId: 2 })
    // 제구 700 → Lv1 60% = 420 → 냉정 22(+0x14 = 0x410000)가 제구 += 제구 / 10 = 462 (b64e6)
    expect(lv1.pitchers[8]?.ability[0]).toBe(462)
    const ace = ACE_BATTERS[2]!
    const 레벨 = { [aceLevelSlotOf('타자', 3)]: 4, [aceLevelSlotOf('투수', 발렌타인 + 1)]: 4 }
    const lv5 = seasonEntryListsOf({
      teamId: 0,
      roster: tableRosterOf(0),
      dayCounter: 0,
      acePitcherId: 발렌타인,
      aceBatterId: 2,
      aceLevels: 레벨,
    })
    const 기대 = aceRecordAbilityAtLevel(ace, 4)
    expect(lv5.batters[9]?.ability).toEqual([기대.hit, 기대.power, 기대.defense, 기대.run])
    expect(lv5.pitchers[8]?.ability[0]).toBeGreaterThan(462)
  })

  it('투수 탭 0번 = 그날 선발 — 표의 로테이션 칸(g % 4)과 같다', () => {
    expect(seasonStarterNameOf(3, tableRosterOf(3), 5)).toBe(teamPitchers(3)[1]?.name)
  })

  it('고친 목록을 되적으면 마선수는 빠지고 투수는 로테이션을 되돌린 순서로 남는다 — 다음 날 로테이션도 이어진다', () => {
    const roster = tableRosterOf(0)
    const day = 2
    const lists = seasonEntryListsOf({ teamId: 0, roster, dayCounter: day, acePitcherId: 0, aceBatterId: 0 })
    // 오늘 선발(0번)을 5번 투수와 바꾼다
    const edited = { ...lists, pitchers: swapEntryPitchers(lists.pitchers, 0, 5) }
    const written = seasonRosterOfEntry(roster, edited, day)
    expect(written.pitchers).toHaveLength(8)
    expect(seasonStarterNameOf(0, written, day)).toBe(teamPitchers(0)[5]?.name)
    // 다음 날은 g+1 번 돈 배열의 0번
    expect(seasonStarterNameOf(0, written, day + 1)).toBe(teamPitchers(0)[3]?.name)
  })

  it('벤치와 바꾼 타자는 수비 위치를 받아 명단에 적힌다', () => {
    const roster = tableRosterOf(0)
    const lists = seasonEntryListsOf({ teamId: 0, roster, dayCounter: 0, acePitcherId: -1, aceBatterId: -1 })
    const written = seasonRosterOfEntry(roster, { ...lists, batters: swapEntryBatters(lists.batters, 0, 10) }, 0)
    expect(written.batters[0]).toMatchObject({ id: 10, fieldPosition: teamBatters(0)[0]?.position })
    expect(written.batters[10]).toMatchObject({ id: 0, fieldPosition: 0 })
    expect(seasonEntryOrderOf(written).batters[0]).toEqual({ rosterSlot: 10, position: teamBatters(0)[0]?.position })
  })
})

describe('영입한 나리 선수(0xfe)는 명단에 든 기록 사본으로 선다', () => {
  const 투수기록 = {
    name: '나리투',
    ability: [1, 2, 3, 4] as const,
    repertoire: { name: '나리투', form: 1, magicId: 2, pitchMask: 3 },
    role: 2 as const,
  }
  const 타자기록 = { name: '나리타', ability: [5, 6, 7, 8] as const }
  const roster = {
    pitchers: [
      { id: 0xfe, kindByte: 0x80, fieldPosition: 0, stamina: 10000, record: 투수기록 },
      { id: 1, kindByte: 1, fieldPosition: 0, stamina: 0 },
    ],
    batters: [{ id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: 타자기록 }],
  }

  it('팀 경기 차례 — recordOf 없이도 사본을 싣는다', () => {
    const order = seasonEntryOrderOf(roster)
    // 원본 id 를 함께 실어 그 선수의 시즌 기록을 제 줄로 쌓게 한다 (0xa8024 → 레코드 +0x20~)
    expect(order.pitchers).toEqual([{ ...투수기록, recordId: 0xfe }, 1])
    expect(order.batters).toEqual([{ rosterSlot: -1, position: 3, record: { ...타자기록, recordId: 0xfe } }])
  })

  it('편집기 목록 — 사본의 이름·능력치', () => {
    const lists = seasonEntryListsOf({ teamId: 0, roster, dayCounter: 0, acePitcherId: -1, aceBatterId: -1 })
    expect(lists.batters[0]).toMatchObject({ name: '나리타', ability: [5, 6, 7, 8] })
    expect(lists.pitchers[0]).toMatchObject({ name: '나리투', ability: [1, 2, 3, 4] })
  })
})

describe('영입 선수 기록에 밑값 · +0x14 · 니블이 있으면 경기 0xb6414 를 시즌 명단 니블로 다시 셈한다 (0xc554 · 0x7d90 · 0xb8680)', () => {
  // 밑값 500 네 칸 · 장착 스킬 7(전설 +50) · 영입 때 히트 니블 2(Lv1 +보너스)
  const 타자기록 = {
    name: '나리타',
    ability: [0, 0, 0, 0] as const,
    baseAbility: [500, 500, 500, 500] as const,
    skillBits: 1 << 7,
    equipment: [2, 0, 0, 0],
  }
  const 투수기록 = {
    ...타자기록,
    name: '나리투',
    repertoire: { name: '나리투', form: 1, magicId: 0, pitchMask: 1 },
  }

  it('시즌 장비 창이 니블을 안 바꿨으면 옮긴 기록의 니블로', () => {
    const order = seasonEntryOrderOf({
      pitchers: [{ id: 0xfe, kindByte: 0x80, fieldPosition: 0, stamina: 10000, record: 투수기록 }],
      batters: [{ id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: 타자기록 }],
    })
    const 보너스 = equipmentBonusOf(2)
    expect(order.batters[0]?.record?.ability).toEqual([500 + 보너스 + 50, 550, 550, 550])
    const 투수 = order.pitchers[0]
    expect(typeof 투수 === 'object' && 'ability' in 투수 ? 투수.ability : null).toEqual([500 + 보너스 + 50, 550, 550, 550])
    // 장착 비트(+0x14)도 경기로 간다
    expect(typeof 투수 === 'object' && 'skillBits' in 투수 ? 투수.skillBits : null).toBe(1 << 7)
  })

  it('시즌에 산 장비(명단 니블)가 얹힌다 — 영입 때 값이 아니라 지금 레코드 값', () => {
    const order = seasonEntryOrderOf({
      pitchers: [],
      batters: [{ id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: 타자기록, equipment: [2, 5, 0, 0] }],
    })
    expect(order.batters[0]?.record?.ability).toEqual([500 + equipmentBonusOf(2) + 50, 500 + equipmentBonusOf(5) + 50, 550, 550])
  })

  it('기록 사본의 니블 · +0xb 도 경기로 넘긴다 — 타석 그림 장비 겹(0x78fd8 · 0x79790)과 폼 · 손이 본다', () => {
    const order = seasonEntryOrderOf({
      pitchers: [
        { id: 0xfe, kindByte: 0x80, fieldPosition: 0, stamina: 10000, record: 투수기록 },
        { id: 0xb4, kindByte: 0x80, fieldPosition: 0, stamina: 10000, record: 투수기록, equipment: [0, 7, 0, 3] },
      ],
      batters: [{ id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: { ...타자기록, profile: 0x34 } }],
    })
    const [옮긴니블, 시즌니블] = order.pitchers
    expect(typeof 옮긴니블 === 'object' && 'equipment' in 옮긴니블 ? 옮긴니블.equipment : null).toEqual([2, 0, 0, 0])
    // 시즌 장비 창이 바꾼 명단 니블이 이긴다 (0x7d90 이 팀 레코드 +0x19 · +0x1a 를 쓴다)
    expect(typeof 시즌니블 === 'object' && 'equipment' in 시즌니블 ? 시즌니블.equipment : null).toEqual([0, 7, 0, 3])
    expect(order.batters[0]?.record).toMatchObject({ equipment: [2, 0, 0, 0], profile: 0x34 })
  })

  it('밑값이 없는 옛 사본은 영입 때 남긴 0xb6414 값 그대로', () => {
    const order = seasonEntryOrderOf({
      pitchers: [],
      batters: [
        { id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: { name: '옛', ability: [1, 2, 3, 4] as const }, equipment: [5, 5, 5, 5] },
      ],
    })
    expect(order.batters[0]?.record?.ability).toEqual([1, 2, 3, 4])
  })
})

describe('명단 차례는 저장 명단의 장비 니블을 싣는다 — 팀 경기의 0xb6414 보너스', () => {
  it('니블이 있는 리그 선수만 equipment 를 싣고, 투수는 표 자리 꼴(표 팀 없이)로 넘긴다', () => {
    const roster = {
      pitchers: [
        { id: 3, kindByte: 3, fieldPosition: 0, stamina: 10000, equipment: [1, 0, 0, 0] },
        { id: 1, kindByte: 1, fieldPosition: 0, stamina: 10000 },
      ],
      batters: [
        { id: 4, kindByte: 4, fieldPosition: 5, stamina: 0, equipment: [0, 2, 0, 0] },
        { id: 0, kindByte: 0, fieldPosition: 2, stamina: 0 },
      ],
    }
    const order = seasonEntryOrderOf(roster)
    expect(order.pitchers).toEqual([{ tableSlot: 3, equipment: [1, 0, 0, 0] }, 1])
    expect(order.batters).toEqual([
      { rosterSlot: 4, position: 5, equipment: [0, 2, 0, 0] },
      { rosterSlot: 0, position: 2 },
    ])
  })
})

describe('0xe0 목록 능력치 = 레코드 0xb6415(rec, k, 1) — 상세 창 0x5b798 → 도형 0x5aefc(팀객체 0)', () => {
  const 나리기록 = {
    name: '나리타',
    ability: [600, 550, 550, 550] as const,
    baseAbility: [500, 500, 500, 500] as const,
    skillBits: 1 << 7,
    equipment: [2, 0, 0, 0],
  }

  it('붙박이 선수도 시즌 명단의 장비 니블을 얹는다 (니블 없으면 표 밑값 그대로)', () => {
    const 표 = teamBatters(0)[4]!
    const lists = seasonEntryListsOf({
      teamId: 0,
      roster: {
        pitchers: [],
        batters: [
          { id: 4, kindByte: 4, fieldPosition: 0, stamina: 0, equipment: [0, 2, 0, 0] },
          { id: 4, kindByte: 4, fieldPosition: 0, stamina: 0 },
        ],
      },
      dayCounter: 0,
      acePitcherId: -1,
      aceBatterId: -1,
    })
    expect(lists.batters[0]?.ability).toEqual([표.ability[0], Math.min(표.ability[1]! + equipmentBonusOf(2), 999), 표.ability[2], 표.ability[3]])
    expect(lists.batters[1]?.ability).toEqual(표.ability)
  })

  it('국가대항전 대한민국(10) 8번 박지혁 · 11번 이태호는 수비불가 20 이라 수비가 100 깎여 보인다 (b6512)', () => {
    const lists = seasonEntryListsOf({ teamId: 10, roster: tableRosterOf(10), dayCounter: 0, acePitcherId: -1, aceBatterId: -1 })
    for (const slot of [8, 11]) {
      const 표 = teamBatters(10)[slot]!
      expect(표.skillBits & (1 << 20)).not.toBe(0)
      expect(lists.batters[slot]?.ability).toEqual([표.ability[0], 표.ability[1], Math.max(표.ability[2]! - 100, 0), 표.ability[3]])
    }
  })

  it('외인구단(14)은 표 행 니블(+0x19 · +0x1a)이 얹혀 보인다', () => {
    const lists = seasonEntryListsOf({ teamId: 14, roster: tableRosterOf(14), dayCounter: 0, acePitcherId: -1, aceBatterId: -1 })
    const 표 = teamBatters(14)[0]!
    expect(표.equipment.some((nibble) => nibble > 0)).toBe(true)
    expect(lists.batters[0]?.ability).not.toEqual(표.ability)
  })

  it('영입 선수는 옮긴 밑값 · +0x14 · 지금 니블로 다시 센다 — 시즌에 바꾼 니블이 얹힌다', () => {
    const lists = seasonEntryListsOf({
      teamId: 0,
      roster: {
        pitchers: [],
        batters: [
          { id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: 나리기록 },
          { id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: 나리기록, equipment: [0, 5, 0, 0] },
          { id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: { name: '옛', ability: [1, 2, 3, 4] as const } },
        ],
      },
      dayCounter: 0,
      acePitcherId: -1,
      aceBatterId: -1,
    })
    // 전설 7 = +50 네 칸 · 니블 2 는 히트에
    expect(lists.batters[0]?.ability).toEqual([500 + equipmentBonusOf(2) + 50, 550, 550, 550])
    expect(lists.batters[1]?.ability).toEqual([550, 500 + equipmentBonusOf(5) + 50, 550, 550])
    // 밑값 칸이 없는 옛 사본은 영입 때 값 그대로
    expect(lists.batters[2]?.ability).toEqual([1, 2, 3, 4])
  })
})

/**
 * U-105 r154 — 0xe8(0x5870)은 0xb512c 를 안 불러 경기 뒤 레코드에 남은 마선수 줄을 그대로 보인다.
 */
describe('레코드 차례 목록 — 레코드에 남은 마선수', () => {
  it('안 넘기면 마선수가 없다 (0xdf · 0xe5 는 진입에서 뺀다)', () => {
    const lists = seasonRecordEntryListsOf(0, tableRosterOf(0), SEASON_ENTRY_CELL_SOURCE)
    expect(lists.pitchers).toHaveLength(8)
    expect(lists.batters).toHaveLength(12)
  })

  it('남은 마투수는 8번 · 마타자는 9번, 마투수 체력은 레코드 +0x2c 값', () => {
    const lists = seasonRecordEntryListsOf(0, tableRosterOf(0), SEASON_ENTRY_CELL_SOURCE, undefined, { pitcher: 1, batter: 2, pitcherStamina: 5000 })
    expect(lists.pitchers).toHaveLength(9)
    expect(lists.pitchers[8]).toMatchObject({ name: ACE_PITCHERS[1]?.name, isAce: true, rosterIndex: -1 })
    expect(lists.pitchers[8]?.stamina?.percent).toBe(50)
    expect(lists.batters).toHaveLength(13)
    expect(lists.batters[9]).toMatchObject({ name: ACE_BATTERS[2]?.name, isAce: true })
    expect(lists.batters[12]?.rosterIndex).toBe(9)
  })

  it('칸 → 레코드 줄: 투수 8줄은 [0..7, 마선수] · 타자 12줄은 [0..8, 마선수, 10, 11, 9]', () => {
    expect(recordAceSeatOf(8, 0, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 'ace'])
    expect(recordAceSeatOf(12, 4, 9)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 'ace', 10, 11, 9])
    expect(recordAceSeatOf(8, -1, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})
