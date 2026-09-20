/**
 * 스윙 타이밍 → 진동 길이 (binary.mod 0xac758 · 메시지 0xbc5 → 0x5228c → 0x3a44 vibrate).
 *
 * 타구가 맞은 모든 스윙에서 타이밍 점수 t(0~100)를 1/2/3 등급으로 자르고, 등급이 곧 진동 길이다.
 * **게임 규칙에는 전혀 영향이 없다 — 순수 햅틱 연출** (R15-ac758.md 1~4절 확정).
 * 웹에는 진동이 없으니(`navigator.vibrate` 0건) 값만 돌려준다.
 */

/** d_level.dat D[0x10] = 0 — 타이밍 점수 하한 */
export const TIMING_SCORE_MINIMUM = 0
/** d_level.dat D[0x12] = 100 — 타이밍 점수 상한 */
export const TIMING_SCORE_MAXIMUM = 100

export type VibrationGrade = 1 | 2 | 3

/** 0x5228c 스위치 — 등급 1/2/3 = 100/200/300 ms */
export const VIBRATION_MILLISECONDS_BY_GRADE: Readonly<Record<VibrationGrade, number>> = {
  1: 100,
  2: 200,
  3: 300,
}

/**
 * 0xac758 본문 그대로:
 *   span = 100 − 0 = 100, v = t − 0
 *   v ≥ span/3(=33)  → 3
 *   v ≤ −span/3(=−33) → 1
 *   그 밖            → 2
 * 나눗셈은 __divsi3(0 쪽으로 자름)이라 100/3 = 33, −100/3 = −33 이다.
 *
 * t 는 0x34be0 이 하한 0 으로 자르므로 **실제로는 등급 1(100ms)이 나오지 않는다** — 코드상 갈래만 남아 있다.
 * 원본 갈래를 그대로 두기 위해 여기서도 음수 입력을 받아 1 을 돌려준다.
 */
export function vibrationGradeOf(timingScore: number): VibrationGrade {
  const span = TIMING_SCORE_MAXIMUM - TIMING_SCORE_MINIMUM
  const value = timingScore - TIMING_SCORE_MINIMUM
  const third = Math.trunc(span / 3)
  if (value >= third) return 3
  if (value <= -third) return 1
  return 2
}

export function vibrationMillisecondsOf(timingScore: number): number {
  return VIBRATION_MILLISECONDS_BY_GRADE[vibrationGradeOf(timingScore)]
}
