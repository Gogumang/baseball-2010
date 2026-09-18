import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'

/**
 * 팀별 선수 명단 — 원본 Team 구조체 (+0x0c 투수 8명 · +0x10 타자 12명, 0x1ff98).
 * `XlsBATTER_DATA` 는 팀마다 12명씩, `XlsPITCHER_DATA` 는 8명씩 이어 붙어 있다
 * (타자 180 = 15팀 × 12, 투수 120 = 15팀 × 8 로 정확히 나뉜다).
 */
export const BATTERS_PER_TEAM = 12
export const PITCHERS_PER_TEAM = 8

export function teamBatters(teamId: number): readonly RosterPlayer[] {
  const from = teamId * BATTERS_PER_TEAM
  return BATTERS.slice(from, from + BATTERS_PER_TEAM)
}

export function teamPitchers(teamId: number): readonly RosterPlayer[] {
  const from = teamId * PITCHERS_PER_TEAM
  return PITCHERS.slice(from, from + PITCHERS_PER_TEAM)
}

/** 능력치 순서는 히트·파워·수비·주루 (0xb6414). 간이 타석은 히트·파워·주루만 본다 */
export function quickBatterOf(player: RosterPlayer): QuickAtBatBatter {
  return { hit: player.ability[0], power: player.ability[1], run: player.ability[3], skillIds: [] }
}

/** 투수 능력치 순서는 제구·구속·변화·체력 */
export function quickPitcherOf(player: RosterPlayer): QuickAtBatPitcher {
  return {
    control: player.ability[0],
    velocity: player.ability[1],
    stamina: player.ability[3],
    skillIds: [],
  }
}

/** 타순 index 번째 타자 (12명을 돌려 쓴다) */
export function batterAt(teamId: number, battingOrderIndex: number): QuickAtBatBatter {
  const roster = teamBatters(teamId)
  return quickBatterOf(roster[battingOrderIndex % roster.length])
}

/** 선발 투수 — 원본 교체 규칙은 아직 해독하지 못해 첫 투수만 쓴다 (추정) */
export function startingPitcherOf(teamId: number): QuickAtBatPitcher {
  return quickPitcherOf(teamPitchers(teamId)[0])
}
