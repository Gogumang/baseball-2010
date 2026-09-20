import { describe, expect, it } from 'vitest'
import {
  BATTERS_PER_TEAM,
  PITCHERS_PER_TEAM,
  batterAt,
  rollStartingPitcherIndex,
  STARTING_PITCHER_CANDIDATES,
  startingPitcherOf,
  teamBatters,
  teamPitchers,
} from '@/entities/team/model/teamRoster'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import type { RandomPort } from '@/shared/api/random/randomPort'

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

describe('선발 투수 무작위 — 0xb8c94(팀, 0, bfa54(0,4)) (S13 1-4b)', () => {
  /** 늘 같은 값을 내는 가짜 난수 — 0~1 을 그대로 돌려준다 */
  const 고정난수 = (value: number): RandomPort => ({
    next: () => value,
    nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
    pick: (candidates) => candidates[0],
  })

  it('로스터 앞 4명 중 하나를 고른다 — 0~3 균등', () => {
    expect(rollStartingPitcherIndex(고정난수(0))).toBe(0)
    expect(rollStartingPitcherIndex(고정난수(0.99))).toBe(STARTING_PITCHER_CANDIDATES - 1)
    expect(STARTING_PITCHER_CANDIDATES).toBe(4)
  })

  it('뽑힌 칸의 투수가 선발이 된다 — 0번 고정이 아니다', () => {
    const 셋째 = teamPitchers(0)[2]

    expect(startingPitcherOf(0, 고정난수(0.6))).toEqual({
      control: 셋째.ability[0],
      velocity: 셋째.ability[1],
      stamina: 셋째.ability[3],
      skillIds: [],
    })
  })

  it('난수를 안 주면 지금까지처럼 0번을 쓴다 (교환이 안 일어난 경우와 같다)', () => {
    expect(startingPitcherOf(0)).toEqual(startingPitcherOf(0, 0))
  })
})
