import type { BurstMissionRow, BurstTableName } from '@/entities/burst-mission/model/burstMissionRow'
import { BURST_TABLES, burstRowsFor, burstTableNameOf } from '@/entities/burst-mission/model/burstMissionRow'
import type { BurstJudgement } from '@/entities/burst-mission/model/burstMissionJudge'
import { judgeBurstGoal } from '@/entities/burst-mission/model/burstMissionJudge'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import { burstRewardDeltasOf } from '@/entities/burst-mission/model/burstMissionReward'
import type { BurstTriggerContext } from '@/entities/burst-mission/model/burstMissionTrigger'
import { rollBurstRow } from '@/entities/burst-mission/model/burstMissionTrigger'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 한 경기 동안의 돌발미션 상태 (원본 돌발 객체, 로더 0x8e1b0 의 초기화 — K 4절 1-1).
 *
 * 원본 필드와의 대응:
 *   obj+0xc   현재 돌발 행 (−1 = 없음)   → `current`
 *   obj+0x21c 결과 상태 (1 실패·2 성공·3 무효) → `judgement`
 *   obj+0x228 이번 경기 발동 횟수          → `triggeredCount`
 *   obj+0x229 경기당 최대 발동 횟수 (= 1)   → `maximumTriggers`
 *   obj+0x22a 게임 모드                    → `mode`
 *
 * 경기 장면은 **모드 2·3·4 일 때만** 이 객체를 만든다 (0x48658 의 `모드−2 ≤ 2`).
 */

/** 경기당 최대 발동 횟수 — 로더가 obj+0x229 에 1 을 넣는다 (0x8e1b0) */
export const MAXIMUM_BURSTS_PER_GAME = 1

export interface BurstSession {
  readonly mode: number
  readonly table: BurstTableName
  readonly triggeredCount: number
  readonly maximumTriggers: number
  /** 진행 중인 돌발. 없으면 null (원본 obj+0xc == −1) */
  readonly current: BurstMissionRow | null
  /** 가장 마지막에 난 판정. 창에 보여 줄 대사 줄·효과음을 여기서 고른다 */
  readonly judgement: BurstJudgement | null
}

/** 모드 2·3·4 가 아니면 돌발 객체 자체를 만들지 않는다 → null */
export function createBurstSession(mode: number): BurstSession | null {
  const table = burstTableNameOf(mode)
  if (table === null) return null
  return {
    mode,
    table,
    triggeredCount: 0,
    maximumTriggers: MAXIMUM_BURSTS_PER_GAME,
    current: null,
    judgement: null,
  }
}

/** 지금 발동을 시도할 수 있는가 (0x8f158: 현재 돌발이 없고 발동 횟수 ≠ 최대) */
export function canTriggerBurst(session: BurstSession): boolean {
  return session.current === null && session.triggeredCount !== session.maximumTriggers
}

/**
 * 타석이 시작될 때 부른다 (장면 상태 0xf → 0x8f158). 발동하면 `current` 가 차고
 * 발동 횟수가 하나 오른다 — 원본도 **뽑은 순간** obj+0x228 을 올린다(0x8f000).
 *
 * `rows` 를 넘기지 않으면 모드·공수에 맞는 원본 표를 쓴다 (`burstMissionRow.ts` 의 `BURST_TABLES`).
 */
export function tryTriggerBurst(
  session: BurstSession,
  context: BurstTriggerContext,
  random: RandomPort,
  rows: readonly BurstMissionRow[] = burstRowsFor(session.mode, context.isHumanTeamBatting, BURST_TABLES),
): BurstSession {
  if (!canTriggerBurst(session)) return session
  const row = rollBurstRow(rows, context, random)
  if (row === null) return session
  return { ...session, current: row, triggeredCount: session.triggeredCount + 1, judgement: null }
}

export interface BurstResolution {
  readonly session: BurstSession
  readonly row: BurstMissionRow | null
  readonly judgement: BurstJudgement | null
  /** 성공 보상·실패 페널티. 무효거나 판정이 안 났으면 비어 있다 */
  readonly deltas: readonly BurstRewardDelta[]
}

/**
 * 타석이 끝날 때 부른다 (0x4e6d4·0x528b0 → `0x8f414(돌발, 0xa7749(결과))`).
 * 판정이 나면 돌발이 끝나고(`current` 가 비고) 결과 상태가 남는다.
 * 결과비트가 0 이거나 목표 5번이면 판정하지 않고 그대로 살려 둔다.
 */
export function resolveBurst(session: BurstSession, resultBits: number): BurstResolution {
  const row = session.current
  if (row === null) return { session, row: null, judgement: null, deltas: [] }

  const judgement = judgeBurstGoal(row.goal, resultBits)
  if (judgement === null) return { session, row, judgement: null, deltas: [] }

  return {
    session: { ...session, current: null, judgement },
    row,
    judgement,
    deltas: burstRewardDeltasOf(row, judgement),
  }
}
