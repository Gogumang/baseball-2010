import { describe, expect, it } from 'vitest'
import {
  BATTERS_PER_TEAM,
  PITCHERS_PER_TEAM,
  batterAt,
  startingPitcherOf,
  teamBatters,
  teamPitchers,
} from '@/entities/team/model/teamRoster'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'

describe('teamRoster — 원본 Team 구조체의 12타자·8투수', () => {
  it('원본 명단이 15팀으로 정확히 나뉜다', () => {
    expect(BATTERS).toHaveLength(15 * BATTERS_PER_TEAM)
    expect(PITCHERS).toHaveLength(15 * PITCHERS_PER_TEAM)
  })

  it('0번 팀은 명단 맨 앞부터, 1번 팀은 그 다음 12명·8명이다', () => {
    expect(teamBatters(0)[0].name).toBe(BATTERS[0].name)
    expect(teamBatters(1)[0].name).toBe(BATTERS[BATTERS_PER_TEAM].name)
    expect(teamPitchers(1)[0].name).toBe(PITCHERS[PITCHERS_PER_TEAM].name)
  })

  it('팀마다 서로 다른 선수를 받는다 — 슬라이스가 겹치지 않는다', () => {
    const 이름 = (teamId: number) => teamBatters(teamId).map((player) => player.name)

    expect(이름(0)).not.toEqual(이름(1))
    expect(new Set([...이름(0), ...이름(1)]).size).toBe(BATTERS_PER_TEAM * 2)
  })

  it('타순은 12명을 돌려 쓴다', () => {
    expect(batterAt(3, 0)).toEqual(batterAt(3, BATTERS_PER_TEAM))
  })

  it('타자는 히트·파워·주루를, 투수는 제구·구속·체력을 가져온다', () => {
    const player = teamBatters(0)[0]
    expect(batterAt(0, 0)).toEqual({
      hit: player.ability[0],
      power: player.ability[1],
      run: player.ability[3],
      skillIds: [],
    })

    const pitcher = teamPitchers(0)[0]
    expect(startingPitcherOf(0)).toEqual({
      control: pitcher.ability[0],
      velocity: pitcher.ability[1],
      stamina: pitcher.ability[3],
      skillIds: [],
    })
  })
})
