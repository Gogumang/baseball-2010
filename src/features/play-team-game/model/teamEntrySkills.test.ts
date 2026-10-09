import { describe, expect, it } from 'vitest'
import { entryBatterSkillIdsOf, entryPitcherSkillIdsOf } from '@/features/play-team-game/model/teamGameFlow'
import { rosterEntryBattersOf, rosterEntryPitchersOf, withAceBatter } from '@/features/play-team-game/model/teamGameRoster'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { aceSkillIdsOf } from '@/entities/mission/model/aceLevel'
import { skillIdsOfBits, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'

describe('명단 선수의 0xab214 스킬 번호 — 레코드 +0x14 (0xb62b4, 모드 검사 없음)', () => {
  it('붙박이 줄은 Xls 행 비트 그대로', () => {
    expect(entryBatterSkillIdsOf(rosterEntryBattersOf(0)[0])).toEqual(skillIdsOfBits(teamBatters(0)[0].skillBits, false))
    expect(entryPitcherSkillIdsOf(rosterEntryPitchersOf(0)[1])).toEqual(skillIdsOfBits(teamPitchers(0)[1].skillBits, true))
  })

  it('마타자 · 마투수는 제 XlsACE 행 (`aceSkillIdsOf`)', () => {
    const 킹타이거 = ACE_BATTERS.findIndex((ace) => ace.name === '킹타이거')
    const 명단 = withAceBatter(rosterEntryBattersOf(0), 킹타이거)
    const 마타자 = 명단.find((entry) => entry.aceIndex === 킹타이거)
    expect(entryBatterSkillIdsOf(마타자)).toEqual(aceSkillIdsOf(ACE_BATTERS[킹타이거]))
    expect(entryBatterSkillIdsOf(마타자)).toContain(22)
    const 발렌타인 = ACE_PITCHERS.findIndex((ace) => ace.name === '발렌타인')
    const 마투수 = { ...rosterEntryPitchersOf(0)[0], aceIndex: 발렌타인, skillBits: undefined }
    // 0x410000 → 비트 16 · 22 → 번호 32 · 38
    expect(entryPitcherSkillIdsOf(마투수)).toEqual([32, 38])
  })
})
