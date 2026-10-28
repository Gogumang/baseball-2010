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
 * 몸통 갈래는 모두 직접 떴다(r280): 검정 0x9aac4 단계 s 는 s 의 비트마다 화면 항 `(p & M) >> k`
 * (8 → 0xf7de>>1 · 4 → 0xe79c>>2 · 2 → 0xc718>>3 · 1 → 0x8610>>4, 갈래 0x9aae2 · 0x9ab06 · … · 0x9add0) 를 더하고,
 * 색 0x9a52c 단계 s 는 화면 몫 15 − s 와 색 몫 s + 1 을 같은 마스크 항으로 더한다(갈래 0x9a54c · 0x9a598 · … · 0x9a92c, 단계 15 = 0x9a976
 * 색 그대로) — 곧 효과 1 반투명(`translucentPixel565`, 단계 L = s + 1)과 같은 줄이다. 채널마다 따로 내림이 들어간다.
 * DOM 덮개는 아래 화면을 못 읽어 CSS 불투명도로 몫을 주고(`blackStepCoverOpacityOf` · `colorStepCoverOpacityOf`),
 * 아래 화면을 아는 캔버스 합성(`shared/lib/pixelEffect/screenCompose`)은 아래 픽셀 식을 그대로 쓴다.
 */
import { translucentPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'

/** 마스크 · 밀기 — 몫 1/2 · 1/4 · 1/8 · 1/16 (표 0xd5e58 · 0xd5de0 와 같은 짝) */
const WEIGHT_TERMS: readonly (readonly [bit: number, mask: number, shift: number])[] = [
  [8, 0xf7de, 1],
  [4, 0xe79c, 2],
  [2, 0xc718, 3],
  [1, 0x8610, 4],
]

/** 몫 w(0~15)/16 — w 의 비트마다 `(p & M) >> k` 를 더한다(채널마다 내림) */
function weightedPixel565(pixel: number, weight: number): number {
  let out = 0
  for (const [bit, mask, shift] of WEIGHT_TERMS) if ((weight & bit) !== 0) out += (pixel & mask) >> shift
  return out
}

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

/** [0x15605d4] 검정 덮기 한 픽셀 — 몸통 0x9aac4: 화면을 단계/16 남긴다(단계 0 = 0x9aae2 검정). 0~15 밖이면 화면 그대로 */
export function blackStepCoverPixel565(step: number, screen: number): number {
  if (!isDrawnStep(step)) return screen
  return weightedPixel565(screen, step) & 0xffff
}

/** [0x15605d0] 색 덮기 한 픽셀 — 몸통 0x9a52c: 화면 (15 − 단계)/16 + 색 (단계 + 1)/16, 단계 15 는 색 그대로(0x9a976). 0~15 밖이면 화면 그대로 */
export function colorStepCoverPixel565(step: number, color: number, screen: number): number {
  if (!isDrawnStep(step)) return screen
  if (step === STEP_COVER_MAX_STEP) return color & 0xffff
  return translucentPixel565(step + 1, color, screen)
}
