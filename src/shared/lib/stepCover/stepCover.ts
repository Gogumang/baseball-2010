/**
 * **단계 덮기** — 화면(또는 칸)을 16 단계로 덮는 두 칠하기 함수 포인터. 0x2ed8 이 깔아 둔다(직접 떴다):
 *
 * ```
 * 0x3110  0x987f9(0, 0x9aac5, 0x9b235)  → [0x15605e4] = 0x9aac4 (16비트 몸통) · [0x15605d4] = 0x9b234 (검정 덮기)
 * 0x3118  0x987f9(1, 0x9a52d, 0x9b3f5)  → [0x15605e0] = 0x9a52c (16비트 몸통) · [0x15605d0] = 0x9b3f4 (색 덮기)
 * ```
 * 감싸는 0x9b234(x, y, w, h, 단계) · 0x9b3f4(x, y, w, h, 색, 단계) 는 **단계 > 15 면(부호 없이 `cmp #0xf ; bhi`) 아무것도 안 칠한다**.
 * 그 밖이면 자르기 칸([0x1221]+0x44)과 화면 안으로 줄인 뒤 픽셀 깊이(8 · 16 · 32)로 몸통을 부른다 — 16비트가 위 몸통이다.
 *
 * - 검정 0x9aac4(점프표 0xd5f88): 단계 0 = 0(완전 검정) · 1 = (p&0x8610)>>4 · 2 = (p&0xc718)>>3 · 3 = 둘의 합 · … ·
 *   8 = (p&0xf7de)>>1 · … · 14 = ½+¼+⅛ · 15 = ½+¼+⅛+1/16. 곧 **화면을 단계/16 만큼 남긴다** → 검정 몫 (16 − 단계)/16.
 * - 색 0x9a52c(점프표 0xd5f48): **색 몫 (단계 + 1)/16** (단계 0 = 1/16 · 15 = 색 그대로) — b89cb45 에서 떴다.
 *
 * 웹은 CSS 불투명도로 몫을 준다(마스크 더하기의 반올림 차이는 근사).
 */

/** 감싸는 함수가 받는 가장 큰 단계 (0x9b242 · 0x9b402 `cmp r1, #0xf`) */
export const STEP_COVER_MAX_STEP = 15

const STEPS = 16

const isDrawnStep = (step: number) => Number.isInteger(step) && step >= 0 && step <= STEP_COVER_MAX_STEP

/** [0x15605d4] 검정 덮기의 검정 불투명도 — (16 − 단계)/16, 0~15 밖이면 0(안 칠한다) */
export function blackStepCoverOpacityOf(step: number): number {
  return isDrawnStep(step) ? (STEPS - step) / STEPS : 0
}

/** [0x15605d0] 색 덮기의 색 불투명도 — (단계 + 1)/16, 0~15 밖이면 0(안 칠한다) */
export function colorStepCoverOpacityOf(step: number): number {
  return isDrawnStep(step) ? (step + 1) / STEPS : 0
}
