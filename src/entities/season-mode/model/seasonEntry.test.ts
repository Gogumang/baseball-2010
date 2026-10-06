import { describe, expect, it } from 'vitest'
import {
  rotatedPitchersOf, seasonEntryListsOf, seasonEntryOrderOf, seasonRosterOfEntry, seasonStarterNameOf,
  tableRosterOf, unrotatedPitchersOf,
} from '@/entities/season-mode/model/seasonEntry'
import { swapEntryBatters, swapEntryPitchers } from '@/entities/season-mode/model/entryEditor'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'

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
    name: '나리투', ability: [1, 2, 3, 4] as const, repertoire: { name: '나리투', form: 1, magicId: 2, pitchMask: 3 }, role: 2 as const,
  }
  const 타자기록 = { name: '나리타', ability: [5, 6, 7, 8] as const }
  const roster = {
    pitchers: [{ id: 0xfe, kindByte: 0x80, fieldPosition: 0, stamina: 10000, record: 투수기록 }, { id: 1, kindByte: 1, fieldPosition: 0, stamina: 0 }],
    batters: [{ id: 0xfe, kindByte: 0xa0, fieldPosition: 3, stamina: 0, record: 타자기록 }],
  }

  it('팀 경기 차례 — recordOf 없이도 사본을 싣는다', () => {
    const order = seasonEntryOrderOf(roster)
    expect(order.pitchers).toEqual([투수기록, 1])
    expect(order.batters).toEqual([{ rosterSlot: -1, position: 3, record: 타자기록 }])
  })

  it('편집기 목록 — 사본의 이름·능력치', () => {
    const lists = seasonEntryListsOf({ teamId: 0, roster, dayCounter: 0, acePitcherId: -1, aceBatterId: -1 })
    expect(lists.batters[0]).toMatchObject({ name: '나리타', ability: [5, 6, 7, 8] })
    expect(lists.pitchers[0]).toMatchObject({ name: '나리투', ability: [1, 2, 3, 4] })
  })
})
