import { describe, expect, it } from 'vitest'
import {
  PITCHER_ENTRY_ACE_SLOT,
  entryBattersOfOrder,
  entryPitchersOfOrder,
  rosterEntryBattersOf,
  rosterEntryPitchersOf,
  withAcePitcher,
} from '@/features/play-team-game/model/teamGameRoster'
import type { TeamEntryOrder } from '@/features/play-team-game/model/teamGameRoster'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'

describe('투수 명단의 레코드 +0x14 스킬 비트 — 공 하나 소모 0xa5e14 의 비겁자(18) · 끈기(10)', () => {
  it('붙박이 줄은 Xls 행 비트 그대로, 마투수는 0', () => {
    const entry = rosterEntryPitchersOf(0)
    expect(entry.map((pitcher) => pitcher.skillBits)).toEqual(teamPitchers(0).map((player) => player.skillBits))
    // 전역 투수 0 번(팀 0 칸 0)은 끈기 줄이다 (104811f)
    expect(((entry[0]!.skillBits ?? 0) >>> 10) & 1).toBe(1)
    expect(withAcePitcher(entry, 0)[PITCHER_ENTRY_ACE_SLOT]!.skillBits ?? 0).toBe(0)
  })
})

describe('명단 능력치는 레코드의 0xb6414(rec, k, 1) — 장비 니블 · 장착 스킬', () => {
  it('붙박이 줄은 Xls 행의 니블·스킬을 먹는다 — 외인구단(14) 타자 배트 니블 3 → 파워 +70', () => {
    const entry = rosterEntryBattersOf(14)
    const row = teamBatters(14)[0]!
    expect(entry[0]!.ability[1]).toBe(Math.min(row.ability[1] + 70, 999))
    expect(entry[0]!.equipment).toEqual([0, 3, 0, 0])
    // 리그 열 팀은 니블이 모두 0 이라 그대로
    expect(rosterEntryBattersOf(0).map((batter) => batter.ability)).toEqual(teamBatters(0).map((player) => player.ability))
  })

  it('명단 차례가 실은 니블(시즌 저장 명단)로 타자·투수 모두 보너스를 먹는다', () => {
    const order: TeamEntryOrder = {
      batters: [{ rosterSlot: 2, position: 3, equipment: [1, 0, 0, 4] }, { rosterSlot: 0, position: 2 }],
      pitchers: [{ tableSlot: 1, equipment: [0, 3, 0, 0] }, 0],
    }
    const batters = entryBattersOfOrder(0, order)
    const rowB = teamBatters(0)[2]!
    expect(batters[0]!.ability).toEqual([rowB.ability[0] + 30, rowB.ability[1], rowB.ability[2], rowB.ability[3] + 90])
    expect(batters[0]!.rosterSlot).toBe(2)
    expect(batters[1]!.ability).toEqual(teamBatters(0)[0]!.ability)
    const pitchers = entryPitchersOfOrder(0, order)
    const rowP = teamPitchers(0)[1]!
    expect(pitchers[0]!.ability).toEqual([rowP.ability[0], rowP.ability[1] + 70, rowP.ability[2], rowP.ability[3]])
    // 제 팀 표 자리 — 표 팀을 따로 들지 않고 칸 1 의 구질·보직으로 선다
    expect(pitchers[0]).toMatchObject({ tableSlot: 1, role: rosterPitcherRoleOf(1) })
    expect(pitchers[0]!.tableTeamId).toBeUndefined()
    expect(pitchers[1]!.ability).toEqual(teamPitchers(0)[0]!.ability)
  })
})
