import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'

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

/**
 * 선발 후보 수 — 원본은 `bfa54(0, 4)` 라 **0~3 균등**이다 (0x3107a·0x31090).
 * 로스터 앞 4명이 선발 로테이션인 셈이다.
 */
export const STARTING_PITCHER_CANDIDATES = 4

/**
 * 경기를 세울 때 고르는 선발 칸 (0x3107a~0x3109e, S13 1-4b 확정).
 * 원본은 `0xb8c94(팀, 0, bfa54(0,4))` = `0xb5e98(명부, 0, k, 1)` 로 **투수 0번과 k번을
 * 레코드째 맞바꾼다**. 교환이라 뽑힌 투수가 0번(= 선발) 자리로 오고, `k = 0` 이면 그대로다.
 *
 * ⚠️ **이 무작위는 일반모드(0x30f20)·대전모드(0x30be0) 것이다** — S13 1-0 이 두 함수가 모드
 * 1 과 8·9 전용임을 확정했다. 리그가 도는 모드(2 시즌 · 3 투수편 · 4 타자편)와 CPU 끼리의
 * 리그 경기는 무작위가 아니라 **하루 한 칸씩 도는 4인 로테이션**이다
 * (0xb8c80 → 0xb5ca8 — `entities/pitcher-career/model/pitcherRotation.rotationSlotOf`).
 */
export function rollStartingPitcherIndex(random: RandomPort): number {
  return Math.trunc(random.nextInRange(0, STARTING_PITCHER_CANDIDATES))
}

/**
 * 선발 투수 — 원본은 경기 시작 때 로스터 앞 4명 중 하나를 골라 0번과 맞바꾼다.
 *
 * `random` 을 주면 그 자리에서 뽑고, 안 주면 지금까지처럼 0번(교환 없는 경우)을 쓴다.
 * ⚠️ 원본의 교환은 저장 레코드를 바꾸므로 **영구**지만, 웹판 로스터는 `shared/config` 의
 * 붙박이 표라 되쓸 수 없다. 그래서 교환 대신 **고른 칸 번호를 부르는 쪽이 경기 내내 들고 다닌다**
 * (`GameProgress` 가 그렇게 쓴다). 한 경기 안에서 보이는 동작은 같고, 다음 경기의 로테이션이
 * 이어지지 않는 것만 다르다.
 */
export function startingPitcherOf(
  teamId: number,
  randomOrIndex: RandomPort | number = 0,
): QuickAtBatPitcher {
  const roster = teamPitchers(teamId)
  const index =
    typeof randomOrIndex === 'number' ? randomOrIndex : rollStartingPitcherIndex(randomOrIndex)
  return quickPitcherOf(roster[index % roster.length])
}
