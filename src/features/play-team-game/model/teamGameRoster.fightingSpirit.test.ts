import { describe, expect, it } from 'vitest'
import {
  entryPitcherGameAbilities,
  entryPitcherGameAbilityParts,
  rosterEntryPitchersOf,
} from '@/features/play-team-game/model/teamGameRoster'
import { hasFightingSpiritBit } from '@/features/play-team-game/model/gameAbilities'

describe('팀 경기 투수 명단의 스킬 14(투지) — 레코드 +0x14 비트 14 ∧ 경기 상태 (A-23)', () => {
  // 붙박이 투수 표 9번(팀 1 칸 1)은 Xls 행 비트 14 가 섰다
  const entry = rosterEntryPitchersOf(1)[1]

  it('표 줄에 비트 14 가 있다', () => {
    expect(hasFightingSpiritBit(entry.skillBits)).toBe(true)
  })

  it('그 팀이 지는 측일 때만 선다 — 제구 · 구속 · 변화는 v/10, 체력은 그대로', () => {
    const base = { mode: 1, seasonTeamId: -1 }
    const off = entryPitcherGameAbilities({ ...base, fightingSpiritOf: (teamId) => teamId !== 1 }, 1, entry)
    const on = entryPitcherGameAbilities({ ...base, fightingSpiritOf: (teamId) => teamId === 1 }, 1, entry)
    expect(on.slice(0, 3)).toEqual(off.slice(0, 3).map((value) => Math.min(999, value + Math.trunc(value / 10))))
    expect(on[3]).toBe(off[3])
    expect(entryPitcherGameAbilityParts({ ...base, fightingSpiritOf: () => true }, 1, entry).fightingSpirit).toBe(true)
    expect(entryPitcherGameAbilityParts(base, 1, entry).fightingSpirit).toBeUndefined()
  })
})
