import { describe, expect, it } from 'vitest'
import {
  PITCHER_ENTRY_ACE_SLOT,
  rosterEntryPitchersOf,
  withAcePitcher,
} from '@/features/play-team-game/model/teamGameRoster'
import { teamPitchers } from '@/entities/team/model/teamRoster'

describe('투수 명단의 레코드 +0x14 스킬 비트 — 공 하나 소모 0xa5e14 의 비겁자(18) · 끈기(10)', () => {
  it('붙박이 줄은 Xls 행 비트 그대로, 마투수는 0', () => {
    const entry = rosterEntryPitchersOf(0)
    expect(entry.map((pitcher) => pitcher.skillBits)).toEqual(teamPitchers(0).map((player) => player.skillBits))
    // 전역 투수 0 번(팀 0 칸 0)은 끈기 줄이다 (104811f)
    expect(((entry[0]!.skillBits ?? 0) >>> 10) & 1).toBe(1)
    expect(withAcePitcher(entry, 0)[PITCHER_ENTRY_ACE_SLOT]!.skillBits ?? 0).toBe(0)
  })
})
