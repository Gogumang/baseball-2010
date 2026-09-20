import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { HIDDEN_PITCH_EVENTS } from '@/entities/pitcher-career/model/pitcherAbility'

/**
 * **구질 훈련** — 투수편 관리 화면에만 있는 칸이다 (J 3-2 확정).
 *
 * 타자편의 훈련 칸 4 는 필살타법 창(상태 0x6c)을 열지만, **모드 3 은 0x12dc0 에서 상태 0x78** 을 연다
 * (R7 4절 149행). 그 창이 이 표를 그린다.
 *
 * 표 `0xcc390` u32 **4행 × 5열** (행 = 계열, 열 0·1 기본 · 2·3 상위 · 4 히든):
 * ```
 * 행0 |  2 TWO-SEAM |  3 H.FAST   | 10 CUT FAST   | 11 R.FAST   | 18 P.SINKER
 * 행1 |  5 SHOOT    |  4 SINKER   | 13 H.SHOOT    | 12 H.SINKER | 19 P.SLIDER
 * 행2 |  7 CURVE    |  6 SLIDER   | 15 S.CURVE    | 14 H.SLIDER | 20 KNUCKLE
 * 행3 |  8 FORK     |  9 CHANGEUP | 16 S.CHANGEUP | 17 GYRO     | 21 SPECIAL
 * ```
 * 칸 상태는 `커리어+0x208 + (행·2 + 열%2)·4 + 1` = **단계**(0 없음 · 1 기본 습득 · 2 상위 습득),
 * 히든 오픈은 `커리어+0x204+행` 이다. 등록에서 고른 기본 변화구 두 개가 그 칸의 단계 1 이다 (J 3-1).
 */

/** 표 0xcc390 — 행 4 × 열 5, 값은 구질 번호 (1 FASTBALL … 21 SPECIAL) */
export const PITCH_TRAINING_TABLE: readonly (readonly number[])[] = [
  [2, 3, 10, 11, 18],
  [5, 4, 13, 12, 19],
  [7, 6, 15, 14, 20],
  [8, 9, 16, 17, 21],
]

export const PITCH_TRAINING_ROW_COUNT = PITCH_TRAINING_TABLE.length
export const PITCH_TRAINING_COLUMN_COUNT = 5
/** 열 4 = 히든 변화구 (이벤트 30~33 으로 계열이 열려야 배운다) */
export const HIDDEN_PITCH_COLUMN = 4

/** 비용 표 `0xcc3e0` s16 [−300, −600, −1000] 를 **열/2** 로 고른다 */
const COST_TABLE: readonly number[] = [300, 600, 1000]

export function pitchTrainingCostOf(column: number): number {
  return COST_TABLE[Math.trunc(column / 2)] ?? 0
}

/** 단계 칸 번호 = 행·2 + 열%2 (열0↔열2 · 열1↔열3 이 한 칸을 함께 쓴다) */
export function pitchTrainingCellOf(row: number, column: number): number {
  return row * 2 + (column % 2)
}

export function pitchTrainingStageOf(career: PitcherCareer, row: number, column: number): number {
  return career.pitchTrainingStages[pitchTrainingCellOf(row, column)] ?? 0
}

export function pitchTypeNumberOf(row: number, column: number): number {
  return PITCH_TRAINING_TABLE[row]?.[column] ?? 0
}

export function pitchTypeNameOf(typeNumber: number): string {
  return PITCH_TYPES[typeNumber - 1]?.name ?? ''
}

export function hasPitchType(career: PitcherCareer, typeNumber: number): boolean {
  return typeNumber > 0 && ((career.pitchMask >>> (typeNumber - 1)) & 1) === 1
}

/**
 * 선행 판정 `0xa42d8`:
 *   - 열0·1 : 같은 칸 단계 ≤ 0
 *   - 열2·3 : 같은 칸(열%2) 단계 ≠ 0  (= 열0 → 열2 · 열1 → 열3)
 *   - 열4   : 계열이 열려 있고 **그 행 두 칸 중 하나라도 단계 == 2**
 */
export function meetsPitchTrainingPrerequisite(career: PitcherCareer, row: number, column: number): boolean {
  if (column === HIDDEN_PITCH_COLUMN) {
    if (!isHiddenPitchRowOpen(career, row)) return false
    return [0, 1].some((offset) => (career.pitchTrainingStages[row * 2 + offset] ?? 0) === 2)
  }
  const stage = pitchTrainingStageOf(career, row, column)
  return column < 2 ? stage <= 0 : stage !== 0
}

export function isHiddenPitchRowOpen(career: PitcherCareer, row: number): boolean {
  return career.hiddenPitchRows[row] === true
}

/**
 * 창이 칸 하나를 골랐을 때의 결과 — 원본 가드 순서 그대로다 (0x17912~0x17a4c).
 *   ① 이미 가진 구질(`0xa436c`) → **아무 말 없이 무시**
 *   ② 단계 > 열/2 → 무시
 *   ③ 열4 인데 계열 미오픈 → StrMODE[67]
 *   ④ 선행 거짓 → StrMODE[68]
 *   ⑤ G포인트 < 비용 → StrMODE[65]
 *   ⑥ 그 밖 → StrMODE[66] "%d G포인트가 소모됩니다" 확인
 */
export type PitchTrainingGate =
  | { readonly kind: '무시' }
  | { readonly kind: '막힘'; readonly textIndex: number }
  | { readonly kind: '확인'; readonly cost: number; readonly textIndex: number }

/** StrMODE 번호 (J 3-2) */
export const PITCH_TRAINING_TEXT = {
  /** [67] 아직 배울 수 없는 구질입니다 / 이벤트를 통해 오픈 */
  hiddenLocked: 67,
  /** [68] 선행 구질 훈련 완료 후 */
  prerequisite: 68,
  /** [65] G포인트가 모자랍니다 */
  notEnoughPoints: 65,
  /** [66] %d G포인트가 소모됩니다 */
  confirm: 66,
} as const

export function pitchTrainingGateOf(career: PitcherCareer, row: number, column: number): PitchTrainingGate {
  const typeNumber = pitchTypeNumberOf(row, column)
  if (typeNumber === 0) return { kind: '무시' }
  if (hasPitchType(career, typeNumber)) return { kind: '무시' }
  if (pitchTrainingStageOf(career, row, column) > Math.trunc(column / 2)) return { kind: '무시' }
  if (column === HIDDEN_PITCH_COLUMN && !isHiddenPitchRowOpen(career, row)) {
    return { kind: '막힘', textIndex: PITCH_TRAINING_TEXT.hiddenLocked }
  }
  if (!meetsPitchTrainingPrerequisite(career, row, column)) {
    return { kind: '막힘', textIndex: PITCH_TRAINING_TEXT.prerequisite }
  }
  const cost = pitchTrainingCostOf(column)
  if (career.gamePoint < cost) return { kind: '막힘', textIndex: PITCH_TRAINING_TEXT.notEnoughPoints }
  return { kind: '확인', cost, textIndex: PITCH_TRAINING_TEXT.confirm }
}

/**
 * 확인에서 [예] — 구질을 배운다.
 *
 * 열0·1 은 칸 단계를 1 로, 열2·3 은 2 로 올린다. **열4(히든)는 단계 칸을 건드리지 않는다** —
 * 히든은 칸이 아니라 계열 플래그(+0x204+행)로 관리되고, 단계를 올리는 줄이 문서에 없다.
 *
 * 훈련 **횟수**(StrMODE[89] "해당 구질 %d/%d회 훈련") 표는 아직 못 찾았다 (J 3-2 미해결) —
 * 한 번에 배우는 것으로 둔다. 횟수 표가 나오면 `sessions` 를 여기에 붙이면 된다.
 */
export function trainPitchType(career: PitcherCareer, row: number, column: number): PitcherCareer {
  const gate = pitchTrainingGateOf(career, row, column)
  if (gate.kind !== '확인') throw new Error(`구질 훈련을 할 수 없는 칸입니다 (행 ${row} 열 ${column})`)
  const typeNumber = pitchTypeNumberOf(row, column)
  const stages = [...career.pitchTrainingStages]
  if (column !== HIDDEN_PITCH_COLUMN) stages[pitchTrainingCellOf(row, column)] = Math.trunc(column / 2) + 1
  return {
    ...career,
    gamePoint: Math.max(0, career.gamePoint - gate.cost),
    pitchMask: career.pitchMask | (1 << (typeNumber - 1)),
    pitchTrainingStages: stages,
  }
}

/**
 * 히든 변화구 계열을 연다 — 이벤트 30~33 의 보상 종류 6(구질) 값이 **행 번호**다 (J 3-3).
 * 조건(능력치·연차)은 `pitcherAbility.HIDDEN_PITCH_EVENTS` 에 있다.
 */
export function openHiddenPitchRow(career: PitcherCareer, row: number): PitcherCareer {
  if (row < 0 || row >= PITCH_TRAINING_ROW_COUNT || career.hiddenPitchRows[row]) return career
  const rows = [...career.hiddenPitchRows]
  rows[row] = true
  return { ...career, hiddenPitchRows: rows }
}

/**
 * 지금 능력치·연차로 열 수 있는 히든 계열 이벤트 — 관리 화면(trigger 0)이 보는 조건이다 (J 3-3).
 * 기간은 "해당 연차의 9경기째부터" 라 `season`·`gamesPlayed` 를 함께 본다.
 */
export function openableHiddenPitchEventOf(career: PitcherCareer): (typeof HIDDEN_PITCH_EVENTS)[number] | null {
  return (
    HIDDEN_PITCH_EVENTS.find((event) => {
      if (career.hiddenPitchRows[event.row]) return false
      if (career.season < event.fromSeason) return false
      if (career.season === event.fromSeason && career.gamesPlayed < 9) return false
      return (
        career.ability.control >= event.control &&
        career.ability.velocity >= event.velocity &&
        career.ability.breaking >= event.breaking
      )
    }) ?? null
  )
}
