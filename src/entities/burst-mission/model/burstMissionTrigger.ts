import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { BaseState } from '@/entities/game/model/baseState'
import { runnerCountOf } from '@/entities/game/model/baseState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 돌발미션 발동 판정 (0x8f158 → 후보 고르기 0x8f000 — K 4절 1-2·1-6, 확정).
 *
 * **매 타석 준비 때**(장면 상태 0xf, 0x50c42~0x50c56) 부른다. 표의 행마다 조건 다섯 가지를
 * 차례로 보고 모두 통과하면 `rand(0,1000)/10 < b9` 주사위를 굴린다. 통과한 후보 중
 * `rand(0, n)` 으로 **균등하게 하나**를 뽑고, 발동하면 상태 0x1b(돌발 창)로 간다.
 *
 * 검사 순서는 원본 그대로다 (난수를 뽑는 횟수까지 같아야 해서 순서가 중요하다):
 *   상황 0x8ee3c → 주자 0x8ede8 → 아웃 0x8ec3c → 점수차 0x8ed50 → 경기 기록 0x8ec9c → 확률 0x8ec64
 */

/** b0 = 10·12·20·21·22 — 상대 **타자**가 그 마타자일 때 (표 0xd5234) */
export const ACE_BATTER_SITUATIONS: Readonly<Record<number, string>> = {
  10: 'medica',
  12: 'roze',
  20: 'kao',
  21: 'death',
  22: 'tiger',
}

/** b0 = 11·13·17·18·19 — 상대 **투수**가 그 마투수일 때 (표 0xd5248) */
export const ACE_PITCHER_SITUATIONS: Readonly<Record<number, string>> = {
  11: 'leony',
  13: 'ballantine',
  17: 'psyker',
  18: 'bbmachine',
  19: 'dragona',
}

export const BURST_SITUATION = {
  /** 0 — 언제나 */
  항상: 0,
  /** 1 — 상대 팀 타순 슬롯(team+0x32)이 2~4, 곧 3~5번 클린업 */
  클린업: 1,
  /** 2 — 역전찬스. 이때는 b1~b3 주자 조건을 **건너뛴다** */
  역전찬스: 2,
} as const

/** 클린업으로 보는 타순 슬롯 (0-기준) — 3·4·5번 타자 */
const CLEANUP_SLOTS = [2, 3, 4]
/** 역전찬스는 0-기준 이닝 > 7, 곧 **9회 이후**다 (game+0x6b) */
const COMEBACK_INNING = 7

/** 타석이 시작될 때의 경기 상황. 이름은 원본이 읽는 값 그대로다 */
export interface BurstTriggerContext {
  /** 사람 팀이 공격 중인가 (game[0x31 + game[0xa]] == 0) */
  readonly isHumanTeamBatting: boolean
  readonly bases: BaseState
  /** 아웃 수 (game+6) */
  readonly outs: number
  /** 0-기준 이닝 (game+0x6b) */
  readonly inning: number
  /** 사용자 팀 점수 */
  readonly ourScore: number
  readonly opponentScore: number
  /** 상대 팀의 지금 타순 슬롯, 0-기준 (team+0x32) */
  readonly opponentBattingSlot: number
  /** 상대 타자가 마타자면 그 id(`acePlayers.ts`), 아니면 null */
  readonly opponentAceBatterId: string | null
  /** 상대 투수가 마투수면 그 id, 아니면 null */
  readonly opponentAcePitcherId: string | null
  /** 지금 타자의 **이번 경기** 안타 수 (기록 +0x12) */
  readonly hitsInGame: number
  /** 지금 타자의 이번 경기 홈런 수 (기록 +0x13) */
  readonly homeRunsInGame: number
  /** 우리 투수의 이번 경기 탈삼진 수 (0xb8ced) */
  readonly strikeoutsInGame: number
}

/** b0 — 상황 검사 0x8ee3c. 점프표 0xd51d8(23칸) 중 3~9·14~16 은 늘 거짓이다 */
export function matchesSituation(row: BurstMissionRow, context: BurstTriggerContext): boolean {
  const situation = row.situation
  if (situation === BURST_SITUATION.항상) return true
  if (situation === BURST_SITUATION.클린업) return CLEANUP_SLOTS.includes(context.opponentBattingSlot)
  if (situation === BURST_SITUATION.역전찬스) {
    const deficit = context.opponentScore - context.ourScore
    return (
      context.inning > COMEBACK_INNING && deficit > 0 && runnerCountOf(context.bases) >= deficit
    )
  }
  const aceBatter = ACE_BATTER_SITUATIONS[situation]
  if (aceBatter !== undefined) return context.opponentAceBatterId === aceBatter
  const acePitcher = ACE_PITCHER_SITUATIONS[situation]
  if (acePitcher !== undefined) return context.opponentAcePitcherId === acePitcher
  return false
}

/** b1·b2·b3 — 주자 검사 0x8ede8. −1 무관 · 0 비어야 · 1 있어야. b0 == 2 면 통째로 건너뛴다 */
export function matchesBases(row: BurstMissionRow, context: BurstTriggerContext): boolean {
  if (row.situation === BURST_SITUATION.역전찬스) return true
  const occupied = [context.bases.first, context.bases.second, context.bases.third]
  return row.bases.every((want, index) => want < 0 || want === Number(occupied[index]))
}

/** b4 — 아웃 검사 0x8ec3c */
export function matchesOuts(row: BurstMissionRow, context: BurstTriggerContext): boolean {
  return row.outs < 0 || row.outs === context.outs
}

/**
 * b5 — 점수차 검사 0x8ed50. 0 이면 무관, 양수 k 는 `1 ≤ (우리−상대) ≤ k`(이기는 중),
 * 음수 −k 는 `1 ≤ (상대−우리) ≤ k`(지는 중)다. **동점은 어느 쪽도 통과하지 못한다.**
 * '우리/상대' 를 사용자 팀 기준으로 본 것은 대사("역전 홈런")를 근거로 한 유력 판단이다
 * (game+0x32 가 반 이닝인지 사용자 쪽인지 미확인 — K 4절 1-2).
 */
export function matchesScoreDifference(row: BurstMissionRow, context: BurstTriggerContext): boolean {
  if (row.scoreDifference === 0) return true
  const lead = context.ourScore - context.opponentScore
  if (row.scoreDifference > 0) return lead >= 1 && lead <= row.scoreDifference
  return -lead >= 1 && -lead <= -row.scoreDifference
}

/** b6·b7 — 이번 경기 기록 검사 0x8ec9c. 1 안타 · 2 홈런 · 3 탈삼진이 **b7 과 같아야** 한다 */
export function matchesGameRecord(row: BurstMissionRow, context: BurstTriggerContext): boolean {
  switch (row.recordKind) {
    case 0:
      return true
    case 1:
      return context.hitsInGame === row.recordCount
    case 2:
      return context.homeRunsInGame === row.recordCount
    case 3:
      return context.strikeoutsInGame === row.recordCount
    default:
      return false
  }
}

/** 주사위를 빼고 조건만 본다 */
export function isRowEligible(row: BurstMissionRow, context: BurstTriggerContext): boolean {
  return (
    matchesSituation(row, context) &&
    matchesBases(row, context) &&
    matchesOuts(row, context) &&
    matchesScoreDifference(row, context) &&
    matchesGameRecord(row, context)
  )
}

/** 확률 검사 0x8ec64 — `rand(0,1000)/10 < b9`. 나눗셈은 0 쪽 버림이라 0~99 와 b9 를 비교한다 */
export function rollChance(chancePercent: number, random: RandomPort): boolean {
  return Math.trunc(randomIntegerBelow(random, 0, 1000) / 10) < chancePercent
}

/**
 * 후보를 모으고 하나를 뽑는다 (0x8f000). 조건을 통과한 **행마다** 주사위를 굴리므로
 * 난수를 뽑는 횟수가 행 순서에 달려 있다 — 표 순서를 바꾸면 안 된다.
 */
export function rollBurstRow(
  rows: readonly BurstMissionRow[],
  context: BurstTriggerContext,
  random: RandomPort,
): BurstMissionRow | null {
  const candidates = rows.filter(
    (row) => isRowEligible(row, context) && rollChance(row.chancePercent, random),
  )
  if (candidates.length === 0) return null
  return candidates[randomIntegerBelow(random, 0, candidates.length)] ?? null
}
