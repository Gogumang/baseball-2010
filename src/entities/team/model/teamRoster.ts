import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'

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

/** 투수 스킬 번호 = 비트 + 16 (`swingSkills` 머리말) */
const PITCHER_SKILL_ID_OFFSET = 16
const SKILL_BIT_COUNT = 32

/**
 * 레코드 +0x14 장착 스킬 비트(`0xb62b4(rec, n)` = `(+0x14 >> n) & 1`)를 0xab214 가 보는 스킬 번호로 —
 * 타자는 비트 그대로, 투수는 비트 + 16. 0xab214 의 스킬 갈래(ab91c~)는 모드를 안 보고 두 레코드 비트를 읽으므로
 * CPU 선수도 제 Xls 행 비트(0x1ff98 사본)대로 스킬이 걸린다.
 */
export function skillIdsOfBits(skillBits: number, isPitcher: boolean): readonly number[] {
  const ids: number[] = []
  for (let bit = 0; bit < SKILL_BIT_COUNT; bit += 1) {
    if (((skillBits >>> bit) & 1) === 1) ids.push(isPitcher ? bit + PITCHER_SKILL_ID_OFFSET : bit)
  }
  return ids
}

/**
 * 능력치 순서는 히트·파워·수비·주루. 간이 타석은 히트·파워·주루만 본다 — 스윙 0xab214 가 `0xb570d(…, 1, 0x5a, 1)` 로 읽으므로
 * 밑값은 레코드의 `0xb6414(rec, k, 1)`(장비 니블 · 장착 스킬, `recordAbilityOf`)이다.
 * `equipment` 를 주면 레코드의 장비 니블이 그 값이다(시즌 저장 명단 — 새 해 CPU 장비 0x665e8 · 내 팀 장비 창). 없으면 Xls 행 그대로.
 */
export function quickBatterOf(player: RosterPlayer, equipment?: readonly number[]): QuickAtBatBatter {
  const ability = recordAbilityOf({ ...player, equipment: equipment ?? player.equipment }, false)
  // 장착 스킬 — 0xab214 ab91c~ 가 `0xb62b4(타자, n)` 로 레코드 비트를 읽는다
  return { hit: ability[0], power: ability[1], run: ability[3], skillIds: skillIdsOfBits(player.skillBits, false) }
}

/**
 * 투수 능력치 순서는 제구·구속·변화·체력 (밑값 0xb6414 — `quickBatterOf` 주석).
 *
 * 손 `0xb63c0(rec)` — 간이 타석 0xab214 가 타자 스킬 13 좌완UP · 14 우완UP 에 쓴다. 로스터 투수는 마선수가 아니라
 * `폼 & 1` 이고, 폼은 같은 레코드 +0xb 상위 니블(`ROSTER_PITCHER_REPERTOIRES`, `PITCHERS` 와 같은 차례 = 전역 번호)이다.
 * 붙박이 표 밖의 선수(전역 번호를 못 찾음)는 손을 싣지 않는다 — 0 으로 본다.
 */
export function quickPitcherOf(player: RosterPlayer, equipment?: readonly number[]): QuickAtBatPitcher {
  const repertoire = ROSTER_PITCHER_REPERTOIRES[PITCHERS.indexOf(player)]
  // 밑값 = 0xb6414(rec, k, 1) — `quickBatterOf` 주석
  const ability = recordAbilityOf({ ...player, equipment: equipment ?? player.equipment }, true)
  return {
    control: ability[0],
    velocity: ability[1],
    stamina: ability[3],
    // 장착 스킬 — 0xab214 가 `0xb62b4(투수, n)` 로 읽는다 (투수 번호 = 비트 + 16)
    skillIds: skillIdsOfBits(player.skillBits, true),
    ...(repertoire === undefined ? {} : { hand: pitcherHandOf(repertoire.form, false) }),
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
  return random.rand(0, STARTING_PITCHER_CANDIDATES)
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
