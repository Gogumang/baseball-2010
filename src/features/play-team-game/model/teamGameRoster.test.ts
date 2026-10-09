import { describe, expect, it } from 'vitest'
import {
  PITCHER_ENTRY_ACE_SLOT,
  aceLeveledAbility,
  entryBattersOfOrder,
  entryPitchersOfOrder,
  rosterEntryBattersOf,
  rosterEntryPitchersOf,
  withAceBatter,
  withAcePitcher,
} from '@/features/play-team-game/model/teamGameRoster'
import type { TeamEntryOrder } from '@/features/play-team-game/model/teamGameRoster'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'

describe('투수 명단의 레코드 +0x14 스킬 비트 — 공 하나 소모 0xa5e14 의 비겁자(18) · 끈기(10)', () => {
  it('붙박이 줄은 Xls 행 비트 그대로, 마투수 · 마타자는 XlsACE 행 비트 그대로 (0xb521c · 0xb53f0 이 통째 베낀다)', () => {
    const entry = rosterEntryPitchersOf(0)
    expect(entry.map((pitcher) => pitcher.skillBits)).toEqual(teamPitchers(0).map((player) => player.skillBits))
    // 전역 투수 0 번(팀 0 칸 0)은 끈기 줄이다 (104811f)
    expect(((entry[0]!.skillBits ?? 0) >>> 10) & 1).toBe(1)
    expect(withAcePitcher(entry, 0)[PITCHER_ENTRY_ACE_SLOT]!.skillBits).toBe(ACE_PITCHERS[0]!.skillBits)
    // 발렌타인(마투수 3) 0x410000 — 실투 16 안정감 · 22 냉정 / 킹타이거(마타자 4) 0x401200 — 압도 22
    expect(withAcePitcher(entry, 3)[PITCHER_ENTRY_ACE_SLOT]!.skillBits).toBe(0x410000)
    expect(withAceBatter(rosterEntryBattersOf(0), 4)[9]!.skillBits).toBe(0x401200)
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

describe('명단 타자의 장착 스킬 비트 — 0xab214 가 0xb62b4(타자, n)로 레코드 +0x14 를 읽는다', () => {
  it('붙박이 표 줄은 Xls 행 비트, 기록으로 선 영입 선수는 그 기록의 비트를 든다', () => {
    expect(rosterEntryBattersOf(0).map((batter) => batter.skillBits)).toEqual(teamBatters(0).map((player) => player.skillBits))
    const order: TeamEntryOrder = {
      batters: [
        { rosterSlot: 3, position: 1 },
        { rosterSlot: -1, position: 2, record: { name: '명전', ability: [500, 500, 500, 500], recordId: 0xb4, skillBits: 1 << 22 } },
      ],
      pitchers: [0],
    }
    const entry = entryBattersOfOrder(0, order)
    expect(entry[0]?.skillBits).toBe(teamBatters(0)[3]?.skillBits)
    expect(entry[1]?.skillBits).toBe(1 << 22)
  })
})

describe('마선수 경기 능력치 aceLeveledAbility — 0xb6415(rec, k, 1): 레벨 배율 뒤 장착 스킬 단계', () => {
  it('발렌타인(마투수 3) 냉정 22 — Lv1 60% 제구 420 에 1/10 을 얹어 462, 다른 칸은 배율만', () => {
    const valentine = ACE_PITCHERS[3]!
    const raw = [valentine.ability.hit, valentine.ability.power, valentine.ability.defense, valentine.ability.run] as const
    const leveled = aceLeveledAbility(raw, '투수', 3, {})
    expect(leveled[0]).toBe(Math.trunc((raw[0] * 60) / 100) + Math.trunc(Math.trunc((raw[0] * 60) / 100) / 10))
    expect(leveled[1]).toBe(Math.trunc((raw[1] * 60) / 100))
  })
})
