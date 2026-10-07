import { describe, expect, it } from 'vitest'
import {
  MY_RECORD_SLOT,
  NO_RECORD_ACE,
  ROOKIE_BATTER_SLOT,
  applyBattingOrderRewards,
  createNariTeamRecords,
  insertMyBatter,
  moveMyBatter,
  myBatterIndexOf,
  nariLineupSlotsOf,
  nariQuickLineupOf,
  nariTeamsOf,
  recordMatchAcesOf,
  renumberedBattingOrderOf,
  seatAceBatter,
  seatNariMatchAces,
  tableNariTeamRecord,
} from '@/entities/career/model/nariTeamRecord'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { rosterLineupOf } from '@/entities/game/model/quickLineup'

const 팀 = 3
const 칸들 = (record: { readonly batters: readonly { readonly slot: number }[] }) => record.batters.map((row) => row.slot)
const 위치들 = (record: { readonly batters: readonly { readonly position: number }[] }) =>
  record.batters.map((row) => row.position)

describe('나리 팀 레코드 — 등록 0x10fb4 (0x204e1 · 0xb53f0 의 0x80 갈래)', () => {
  it('붙박이 표 그대로 — 타자 열둘 · 수비 위치 니블 · 마투수 없음', () => {
    const record = tableNariTeamRecord(팀)
    expect(칸들(record)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(위치들(record)).toEqual(teamBatters(팀).map((player) => player.position ?? 0))
    expect(record.acePitcher).toBe(NO_RECORD_ACE)
  })

  it('내 선수는 칸 t 에 그 선수의 수비 위치로 앉고, 옛 주인은 위치 0 으로 맨 끝 벤치에 간다', () => {
    const table = tableNariTeamRecord(팀)
    const record = insertMyBatter(table, ROOKIE_BATTER_SLOT)
    expect(칸들(record)).toEqual([0, 1, 2, 3, 4, 5, 6, MY_RECORD_SLOT, 8, 9, 10, 11, 7])
    expect(record.batters[7].position).toBe(table.batters[7].position)
    expect(record.batters[12].position).toBe(0)
  })

  it('열 팀 중 내 팀에만 넣는다 — 투수편(null)은 붙박이 그대로', () => {
    const records = createNariTeamRecords(팀, ROOKIE_BATTER_SLOT)
    expect(records).toHaveLength(10)
    expect(myBatterIndexOf(records[팀])).toBe(ROOKIE_BATTER_SLOT)
    expect(records.filter((record) => myBatterIndexOf(record) >= 0)).toHaveLength(1)
    expect(createNariTeamRecords(팀, null).every((record) => myBatterIndexOf(record) < 0)).toBe(true)
  })

  it('저장에 레코드가 없으면 타순 − 1 칸에 내 선수를 넣은 꼴로 세운다 (옛 저장)', () => {
    const records = nariTeamsOf({ teamId: 팀, battingOrder: 9 })
    expect(myBatterIndexOf(records[팀])).toBe(8)
    expect(칸들(records[팀]).at(-1)).toBe(8)
    expect(renumberedBattingOrderOf({ teamId: 팀, battingOrder: 9 })).toBe(9)
  })
})

describe('142 마선수 넣기 — 0xb8870 · 0xb88c8 (0xb53f0 의 0x40 · 0xb521c 의 0x60 갈래)', () => {
  it('마타자는 9번 칸, 옛 9번은 맨 끝 — 다음 넣기는 같은 칸을 덮는다(빼는 코드가 없다)', () => {
    const first = seatAceBatter(insertMyBatter(tableNariTeamRecord(팀), 7), 2)
    expect(칸들(first)).toEqual([0, 1, 2, 3, 4, 5, 6, MY_RECORD_SLOT, 8, 12, 10, 11, 7, 9])
    expect(first.batters[9].ace).toBe(2)
    const second = seatAceBatter(first, 4)
    expect(칸들(second)).toEqual(칸들(first))
    expect(second.batters[9].ace).toBe(4)
  })

  it('두 팀에 넣고 다시 읽는다 — 번호는 0x1f824 · 0x1f84c 처럼 0..4 로 자른다', () => {
    const records = seatNariMatchAces(createNariTeamRecords(팀, 7), 팀, 5, {
      myBatter: 1, myPitcher: 0, opponentPitcher: 3, opponentBatter: -1,
    })
    expect(recordMatchAcesOf(records, 팀, 5)).toEqual({ myBatter: 1, myPitcher: 0, opponentPitcher: 3, opponentBatter: 0 })
    expect(recordMatchAcesOf(records, 팀, 6)).toEqual({ myBatter: 1, myPitcher: 0, opponentPitcher: -1, opponentBatter: -1 })
    expect(recordMatchAcesOf(createNariTeamRecords(팀, 7), 팀, 5)).toBeNull()
  })

  it('경기 명단 — 레코드 차례 그대로, 마타자는 표지 칸 12, 내 줄은 내 첨자(주루 근사가 읽는 표 칸)', () => {
    const record = seatAceBatter(insertMyBatter(tableNariTeamRecord(팀), 7), 0)
    expect(nariLineupSlotsOf(record)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 10, 11, 7, 9])
    const lineup = nariQuickLineupOf(record)
    expect(lineup.benchBatters).toBe(5)
    // 붙박이 표 그대로의 레코드면 예전 명단(`rosterLineupOf`)과 같다
    expect(nariQuickLineupOf(tableNariTeamRecord(팀))).toEqual(rosterLineupOf(12))
  })
})

describe('타순 보상 19 — 0xb5d09 (셋이 돈다)', () => {
  it('내 선수는 새 칸(그 칸의 위치)으로, 그 칸의 선수는 떠난 칸 원래 주인의 자리(위치 0)로, 원래 주인은 떠난 칸으로', () => {
    const before = insertMyBatter(tableNariTeamRecord(팀), 7)
    const after = moveMyBatter(before, 8)
    expect(칸들(after)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, MY_RECORD_SLOT, 9, 10, 11, 8])
    expect(after.batters[8].position).toBe(before.batters[8].position)
    expect(after.batters[7].position).toBe(before.batters[7].position)
    expect(after.batters[12].position).toBe(0)
    // 마선수가 없는 동안은 "새 칸에 내 선수 · 그 칸의 옛 주인을 맨 끝" 꼴과 같다 (옛 저장을 이 꼴로 세우는 근거)
    expect(after).toEqual(insertMyBatter(tableNariTeamRecord(팀), 8))
  })

  it('마타자가 든 레코드에서도 같은 자리를 돈다', () => {
    const before = seatAceBatter(insertMyBatter(tableNariTeamRecord(팀), 7), 1)
    expect(칸들(moveMyBatter(before, 6))).toEqual([0, 1, 2, 3, 4, 5, MY_RECORD_SLOT, 7, 8, 12, 10, 11, 6, 9])
  })

  it('원본 그대로 — 같은 칸이면 내 선수가 벤치로 내려간다', () => {
    const before = insertMyBatter(tableNariTeamRecord(팀), 7)
    const after = moveMyBatter(before, 7)
    expect(myBatterIndexOf(after)).toBe(12)
    expect(after.batters[7].slot).toBe(7)
  })

  it('보상 값마다 차례로 돌리고 타순을 레코드 첨자 + 1 로 다시 읽는다 — 저장에 없으면 보상 전 타순으로 세운다', () => {
    const moved = applyBattingOrderRewards({ teamId: 팀, battingOrder: 8 }, [9])
    expect(moved?.battingOrder).toBe(9)
    expect(myBatterIndexOf(moved!.nariTeams[팀])).toBe(8)
    expect(칸들(moved!.nariTeams[팀]).at(-1)).toBe(8)
    expect(applyBattingOrderRewards({ teamId: 팀, battingOrder: 8 }, [])).toBeNull()
  })
})
