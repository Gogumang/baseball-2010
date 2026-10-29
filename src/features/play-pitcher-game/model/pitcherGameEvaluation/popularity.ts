import { isStarterTypePosition } from '@/entities/pitcher-career/model/pitcherRole'
import { PITCHER_DECISION_CODE } from '@/entities/game/model/winLossSave'
import { isBugFixed } from '@/shared/config/bugfixes'
import { completeGameKindOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/completeGame'
import { atLeastStepOf, atMostStepOf, type ScoreSteps } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/scoreSteps'
import type {
  CompleteGameKind,
  PitcherEvaluationContext,
  PitcherEvaluationRecord,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation/types'

/* ── 5-3. 인기도 변화 0xa690c (모드 3 가지 0xa6aa4~0xa6ed8) ───────────────────────── */

/** 선발형 점수 s → p (0xa6c9c 계열). 눈금이 두 배라 −2 … 12 다 */
const STARTER_POPULARITY_STEPS: ScoreSteps = [
  [-5, -2],
  [-3, -1],
  [0, 0],
  [2, 2],
  [4, 4],
  [6, 6],
  [8, 8],
  [10, 10],
]
const STARTER_POPULARITY_TOP = 12

/** 구원형 점수 s → p. 타자편과 같은 눈금 −2 … 6 이다 (`== 3 → 2` · `== 8 → 5` 는 앞 칸 뒤의 `≤`) */
const RELIEF_POPULARITY_STEPS: ScoreSteps = [
  [-4, -2],
  [-2, -1],
  [0, 0],
  [2, 1],
  [3, 2],
  [5, 3],
  [7, 4],
  [8, 5],
]
const RELIEF_POPULARITY_TOP = 6

/** 선발 탈삼진 점수 — `> 10 → 6 · ≥ 9 → 5 · ≥ 7 → 4 · ≥ 5 → 3 · ≥ 3 → 2 · ≥ 1 → 1` */
const STARTER_STRIKEOUT_STEPS: ScoreSteps = [
  [11, 6],
  [9, 5],
  [7, 4],
  [5, 3],
  [3, 2],
  [1, 1],
]

/** 선발 잡은 아웃 점수 — `> 26 → 3 · ≥ 24 → 2 · ≥ 21 → 1 · ≥ 9 → 0 · ≥ 6 → −1 · ≥ 3 → −2`, 그 밑 −4 */
const STARTER_OUT_STEPS: ScoreSteps = [
  [27, 3],
  [24, 2],
  [21, 1],
  [9, 0],
  [6, -1],
  [3, -2],
]
const STARTER_OUT_BOTTOM = -4

/** 구원 탈삼진 점수 — `> 5 → 6 · == 5 → 5 · == 4 → 4 · == 3 → 3 · ≥ 1 → 2` */
const RELIEF_STRIKEOUT_STEPS: ScoreSteps = [
  [6, 6],
  [5, 5],
  [4, 4],
  [3, 3],
  [1, 2],
]

/** 구원 이닝 점수 — 이닝 `> 5 → 3 · == 5 → 2 · == 4 → 1` */
const RELIEF_INNING_STEPS: ScoreSteps = [
  [6, 3],
  [5, 2],
  [4, 1],
]

/** 구원 실점 감점 — `> 4 → 4 · > 3 → 2 · > 0 → 1` (0xa6d1c · 0xa6dd6) */
const RELIEF_RUN_PENALTY_STEPS: ScoreSteps = [
  [5, 4],
  [4, 2],
  [1, 1],
]

/** 선발 실점 항 — 원본 문턱(음수 비교) · 고친 문턱(B-39) */
const STARTER_RUN_STEPS_ORIGINAL: ScoreSteps = [
  [-6, -4],
  [-5, -2],
  [-3, -1],
]
const STARTER_RUN_STEPS_FIXED: ScoreSteps = [
  [6, -4],
  [5, -2],
  [3, -1],
]

/** 선발 승리 기본 점수 — 퍼펙트·노히트 6 · 완봉 5 · 완투 3 · 그 밖 2 (진 경기는 −1) */
const STARTER_WIN_BASE: Readonly<Record<CompleteGameKind, number>> = { 퍼펙트: 6, 노히트: 6, 완봉: 5, 완투: 3, 없음: 2 }
const STARTER_LOSS_BASE = -1

/**
 * ⚠️ **원본 버그 그대로**: 실점 항의 비교가 **음수**다 (`≤ −6 → −4 · ≤ −5 → −2 · ≤ −3 → −1`).
 * 0xa6c92: `ldr r3,[R+0x128] ; adds r3,#6 ; bgt` 처럼 **더해서** 0 과 견준다 — 실점은 0 이상이라
 * 이 항은 실점이 나도 한 번도 걸리지 않는다 (선발 인기도는 완봉/완투 갈래로만 실점을 본다).
 *
 * **고침(`bugfixes.json` B-39, 기본 켬)**: 문턱 −6 · −5 · −3 을 실점 6 · 5 · 3 으로 읽는다(`adds #6` 는 `cmp #−6` 의 꼴 —
 * 부호만 뒤집힌 것으로 보고 크기 · 감점 값은 그대로). 실점 6↑ −4 · 5 −2 · 3~4 −1. 인기도가 내려가 평판 · 사기도 따라 바뀐다. 굴림 없음.
 */
function starterRunPoints(runsAllowedField: number): number {
  // 고침(B-39): 부호를 바로 — 실점 6 이상 −4 · 5 −2 · 3~4 −1
  if (isBugFixed('B-39')) return atLeastStepOf(STARTER_RUN_STEPS_FIXED, runsAllowedField, 0)
  return atMostStepOf(STARTER_RUN_STEPS_ORIGINAL, runsAllowedField, 0)
}

function starterPopularityChangeOf(record: PitcherEvaluationRecord, context: PitcherEvaluationContext): number {
  const base = context.won ? STARTER_WIN_BASE[completeGameKindOf(record, context)] : STARTER_LOSS_BASE
  const score =
    base +
    atLeastStepOf(STARTER_STRIKEOUT_STEPS, record.strikeouts, 0) +
    atLeastStepOf(STARTER_OUT_STEPS, record.outsRecorded, STARTER_OUT_BOTTOM) +
    starterRunPoints(record.runsAllowedField)
  return atMostStepOf(STARTER_POPULARITY_STEPS, score, STARTER_POPULARITY_TOP)
}

/** 앞선 채 올라온 구원(세이브 기회)의 갈래 점수 — 지면 −4, 승·세이브면 +3. 아니면 이기면 +5 · 지면 −2 */
function reliefEntryPoints(record: PitcherEvaluationRecord, won: boolean): number {
  if (!record.leadingAtEntry) return won ? 5 : -2
  const decided = record.decisionCode === PITCHER_DECISION_CODE.win || record.decisionCode === PITCHER_DECISION_CODE.save
  return (won ? 0 : -4) + (decided ? 3 : 0)
}

function reliefPopularityChangeOf(record: PitcherEvaluationRecord, context: PitcherEvaluationContext): number {
  const outs = record.outsRecorded
  const score =
    -atLeastStepOf(RELIEF_RUN_PENALTY_STEPS, record.runsAllowedField, 0) +
    atLeastStepOf(RELIEF_STRIKEOUT_STEPS, record.strikeouts, 0) +
    reliefEntryPoints(record, context.won) +
    atLeastStepOf(RELIEF_INNING_STEPS, Math.trunc(outs / 3), 0) +
    (outs <= 2 ? -2 : 0)
  // 아웃 ≤ 2 이고 등판조차 못 했으면 0 (0xa6ec2)
  if (outs <= 2 && context.neverEntered) return 0
  return atMostStepOf(RELIEF_POPULARITY_STEPS, score, RELIEF_POPULARITY_TOP)
}

/** 경기 뒤 인기도 변화 p — `career+0x4a` 에 적히고 평판·사기가 읽는다 */
export function popularityChangeOf(record: PitcherEvaluationRecord, context: PitcherEvaluationContext): number {
  return isStarterTypePosition(context.positionCode) ? starterPopularityChangeOf(record, context) : reliefPopularityChangeOf(record, context)
}
