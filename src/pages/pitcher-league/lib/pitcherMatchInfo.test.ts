import { describe, expect, it } from 'vitest'
import { pitcherMatchInfoOf } from '@/pages/pitcher-league/lib/pitcherMatchInfo'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { teamPitchers } from '@/entities/team/model/teamRoster'

const 투수 = (role: PitcherRole, gamesPlayed: number) => ({
  ...createPitcherCareer('나투수', { role, typeIndex: 0, handIndex: 0, skinIndex: 0, breakingPitchSlots: [], teamId: 3 }),
  gamesPlayed,
})

describe('투수편 142 선발 줄 — 0x1c46c 모드 3 갈래 (0xa4f60 의 k)', () => {
  it('선발 보직: 시즌 첫 경기(g 0 — 그대로)·내 선발 날은 내 투수, 아닌 날은 0↔k 의 k 번', () => {
    expect(pitcherMatchInfoOf(투수(PITCHER_ROLE.starter, 0), null).lines[2].user).toBe('나투수')
    expect(pitcherMatchInfoOf(투수(PITCHER_ROLE.starter, 2), null).lines[2].user).toBe('나투수')
    // g 1 → k = 1
    expect(pitcherMatchInfoOf(투수(PITCHER_ROLE.starter, 1), null).lines[2].user).toBe(teamPitchers(3)[1]?.name)
  })

  it('구원 보직은 0~3 로테이션의 0번이다', () => {
    expect(pitcherMatchInfoOf(투수(PITCHER_ROLE.relief, 1), null).lines[2].user).toBe(teamPitchers(3)[1]?.name)
  })
})
