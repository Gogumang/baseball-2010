import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { isCompleteGame, REGULATION_OUTS } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/completeGame'
import { atLeastStepOf, type ScoreSteps } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/scoreSteps'
import type {
  PitcherEvaluationContext,
  PitcherEvaluationRecord,
  ReputationParts,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation/types'

/* ── 5-2. 평판 변화 0xa6218 (모드 3 가지 0xa6374~0xa6684 + 공통 꼬리 0xa6686) ───────── */

const trunc = Math.trunc

/** 선발 인기도 p → 평판 가점 r 의 첫 항 (6→2 · 8→4 · 10→6 · 12→8, 그 밖 0) */
const STARTER_GAIN_OF_POPULARITY: Readonly<Record<number, number>> = { 6: 2, 8: 4, 10: 6, 12: 8 }
/** 구원 인기도 p → 평판 가점 r 의 첫 항 (3→1 · 4→2 · 5→3 · 6→4) */
const RELIEF_GAIN_OF_POPULARITY: Readonly<Record<number, number>> = { 3: 1, 4: 2, 5: 3, 6: 4 }

/** 연속 탈삼진 가점 — 선발 `≥ 6 → 8 · ≥ 4 → 6 · ≥ 2 → 4`, 구원 `→ 4 · 3 · 2` */
const STARTER_COMBO_STEPS: ScoreSteps = [
  [6, 8],
  [4, 6],
  [2, 4],
]
const RELIEF_COMBO_STEPS: ScoreSteps = [
  [6, 4],
  [4, 3],
  [2, 2],
]
/** 탈삼진 가점 — 선발 `≥ 13 → 6 · ≥ 9 → 4 · ≥ 5 → 2`, 구원 `≥ 6 → 3 · ≥ 4 → 2 · ≥ 2 → 1` */
const STARTER_STRIKEOUT_STEPS: ScoreSteps = [
  [13, 6],
  [9, 4],
  [5, 2],
]
const RELIEF_STRIKEOUT_STEPS: ScoreSteps = [
  [6, 3],
  [4, 2],
  [2, 1],
]
/** 구원 피안타 가점 — 0 → 3 · 1 → 2 · 2 → 1 */
const RELIEF_HITS_GAIN: Readonly<Record<number, number>> = { 0: 3, 1: 2, 2: 1 }
/** 실점 감점 — 선발 `> 5 → −5 · 4·5 → −3` (0xa651c~0xa653a), 구원 `> 3 → −5 · 2·3 → −3` (0xa663c) */
const STARTER_RUN_PENALTY_STEPS: ScoreSteps = [
  [6, -5],
  [4, -3],
]
const RELIEF_RUN_PENALTY_STEPS: ScoreSteps = [
  [4, -5],
  [2, -3],
]

/** 선발 완투 계열 가점 — 출루 없는 완투 7 · 무안타 무실점 6 · 무실점 5 · 그 밖 완투 4 (팀 기록 state+0x88~0x8a 로 가른다) */
function starterCompleteGameGain(record: PitcherEvaluationRecord, context: PitcherEvaluationContext): number {
  if (!isCompleteGame(record, context.endedInningIndex)) return 0
  const shutout = context.teamRunsAllowed === 0
  const noHitShutout = shutout && context.teamHitsAllowed === 0
  if (noHitShutout && !context.teamBaserunnerAllowed && record.outsRecorded <= REGULATION_OUTS) return 7
  if (noHitShutout) return 6
  return shutout ? 5 : 4
}

/** 선발(보직 0)의 가점 (0xa6374~) */
function starterReputationGain(record: PitcherEvaluationRecord, context: PitcherEvaluationContext, popularity: number): number {
  return (
    (STARTER_GAIN_OF_POPULARITY[popularity] ?? 0) +
    atLeastStepOf(STARTER_COMBO_STEPS, record.strikeoutCombo, 0) +
    atLeastStepOf(STARTER_STRIKEOUT_STEPS, record.strikeouts, 0) +
    (record.perfectInnings > 2 ? 2 : 0) +
    (trunc(record.outsRecorded / 3) > 9 ? 4 : 0) +
    (record.hitsAllowed <= 3 ? 3 : 0) +
    starterCompleteGameGain(record, context)
  )
}

/** 선발의 감점 (음수 합) */
function starterReputationPenalty(record: PitcherEvaluationRecord): number {
  return (
    (record.hitsAllowed > 9 ? -5 : 0) +
    (trunc(record.outsRecorded / 3) <= 1 ? -2 : 0) +
    (record.walksAllowed > 2 ? -2 : 0) +
    atLeastStepOf(STARTER_RUN_PENALTY_STEPS, record.runsAllowedField, 0)
  )
}

/** 구원(보직 ≠ 0)의 가점 (0xa64.. ~) */
function reliefReputationGain(record: PitcherEvaluationRecord, popularity: number): number {
  return (
    (RELIEF_GAIN_OF_POPULARITY[popularity] ?? 0) +
    atLeastStepOf(RELIEF_COMBO_STEPS, record.strikeoutCombo, 0) +
    atLeastStepOf(RELIEF_STRIKEOUT_STEPS, record.strikeouts, 0) +
    (record.perfectInnings > 0 ? 1 : 0) +
    (trunc(record.outsRecorded / 3) > 2 ? 2 : 0) +
    // 무실점이면 +1 (0xa65d6)
    (record.runsAllowedField === 0 ? 1 : 0) +
    (RELIEF_HITS_GAIN[record.hitsAllowed] ?? 0)
  )
}

/** 구원의 감점 (~ 0xa6684) */
function reliefReputationPenalty(record: PitcherEvaluationRecord): number {
  return (
    (record.hitsAllowed > 4 ? -3 : 0) +
    (trunc(record.outsRecorded / 3) <= 0 ? -2 : 0) +
    atLeastStepOf(RELIEF_RUN_PENALTY_STEPS, record.runsAllowedField, 0) +
    (record.walksAllowed > 1 ? -2 : 0)
  )
}

/** 구원이 등판조차 못 했으면 가점·감점이 통째로 없다 (0xa666e) */
const NO_ENTRY_PARTS: ReputationParts = { gain: 0, penalty: 0 }

export function reputationPartsOf(record: PitcherEvaluationRecord, context: PitcherEvaluationContext, popularity: number): ReputationParts {
  if (context.role === PITCHER_ROLE.starter) {
    return { gain: starterReputationGain(record, context, popularity), penalty: starterReputationPenalty(record) }
  }
  if (context.neverEntered) return { ...NO_ENTRY_PARTS }
  return { gain: reliefReputationGain(record, popularity), penalty: reliefReputationPenalty(record) }
}

/** 평판 구간 보정 가점 표 `0xd82a0` */
export const REPUTATION_GAIN_TABLE: readonly number[] = [90, 70, 50, 20, 10, 0, -5, -10, -15, -20]
/** 평판 구간 보정 감점 표 `0xd82c8` */
export const REPUTATION_PENALTY_TABLE: readonly number[] = [-90, -70, -50, -30, -10, 0, 5, 10, 20, 30]

/**
 * 공통 꼬리 (0xa6686, 타자편과 같은 코드).
 * ```
 * i = trunc((평판 − 1) / 100)
 * Δ = (r + trunc(r·A[i]/100)) + (pen − trunc(|pen|·B[i]/100))
 * ```
 * 평판이 낮을 때는 가점을 거의 두 배, 감점은 10% 로 줄이고, 높을 때는 반대로 만든다.
 * (웹 타자편 `entities/career/model/gameEvaluation.reputationChangeOf` 에도 이 꼬리가 빠져 있다 —
 *  그쪽은 내 담당이 아니라 건드리지 않는다.)
 */
export function applyReputationTail(parts: ReputationParts, reputation: number): number {
  const index = Math.min(Math.max(trunc((reputation - 1) / 100), 0), REPUTATION_GAIN_TABLE.length - 1)
  const gain = parts.gain + trunc((parts.gain * REPUTATION_GAIN_TABLE[index]) / 100)
  const penalty = parts.penalty - trunc((Math.abs(parts.penalty) * REPUTATION_PENALTY_TABLE[index]) / 100)
  return gain + penalty
}
