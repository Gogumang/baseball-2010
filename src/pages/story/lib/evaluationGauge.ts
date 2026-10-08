/**
 * **116 평가 내장 이벤트의 인기도 변화 막대** — 0x8b5ac 가 [이벤트+0xb] 일 때 0x7fbc4(대사 상자) 뒤에 더 그리는 셋 (직접 떴다).
 *
 * ```
 * 세우기  0x8a6fc → 0x8587c(gfx, v = [sp+0xd4] = S+0x4a 이번 경기 인기도 변화 (= [mgr+0x2e8]), d):
 *           d = 0x8a816~0x8a81c: 시즌모드(0x7b999) 12 · 타자편(0x7b971, 모드 4) 6 · 그 밖(투수편) 보직 0xb6705 ≠ 0 이면 6, 0(선발) 이면 12
 *           +0x1d0 지금 = 0 · v ≥ 0: +0x1d8 목표 = v × 60 / d (0xca7b5) · +0x1d4 걸음 = 1
 *                         v < 0: 목표 = v · 걸음 = −1 · 지금 = v == −1 ? 30 : 60
 * 그림    0x8b5ac (0x8b72c~0x8b75a, [이벤트+0xb] ≠ 0):
 *         0x847e0(gfx, −1, −1): B = mode_ui 프레임 10 박스 0 (0, 65, 240, 72) → (x, y) = (B.x + 1, B.y + B.h − 1) = (1, 136)
 *           프레임 58(+0xe8) 을 (x, y) 에 · G = 프레임 58 박스 0 (5, −63, 13, 60)
 *           i = 0..지금−1: 프레임 59(+0xec, 13×1) 를 (x + G.x, y + G.y + G.h − 1 − i) = (6, 132 − i) 에
 *         0x85944(gfx, [mgr+0x2e8], −1, −1): 칸 (x + G.x + G.w + 6, y + G.y + G.h − 8, 14, 10) = (25, 125, 14, 10)
 *           앱 글꼴 색 0x1400748(0xF7, 0x92, 0) · v ≥ 0 이면 "+"(0xcc270) · 아니면 "-"(0xcc274) 를 0xba411(칸, 정렬 0x21) 로 두 번 —
 *           둘째는 "+" 면 x + 1, "-" 면 y + 1 (굵게). 정렬 0x20 은 (10 − 11) >> 1 = −1 → 글 y = 124
 *           0xba719(칸, 자간 0, |v|, 기준 0x50(num 80~89), num, 정렬 0x14, ox = |v| > 9 ? 5 : 0, oy 0)
 *         0x858cc(gfx): 지금 ≠ 목표 면 지금 += 걸음 — 그린 뒤에 한 걸음
 * ```
 */

/** 0x8587c 가 목표를 잡는 눈금 — 막대 끝 60 줄 */
const GAUGE_ROWS = 60

/** mode_ui 프레임 */
export const EVALUATION_GAUGE_FRAMES = { base: 58, fill: 59 } as const

/** 0x847e0 — 프레임 10 박스 0 (0, 65, 240, 72) 의 (x + 1, y + h − 1) */
export const EVALUATION_GAUGE_ANCHOR = { x: 0 + 1, y: 65 + 72 - 1 } as const

/** 프레임 58 박스 0 (5, −63, 13, 60) — 채움 줄이 쌓이는 칸 */
const GAUGE_BOX = { x: 5, y: -63, width: 13, height: 60 } as const

/** 채움 첫 줄(맨 아래) — (x + G.x, y + G.y + G.h − 1) */
export const EVALUATION_GAUGE_FILL = {
  x: EVALUATION_GAUGE_ANCHOR.x + GAUGE_BOX.x,
  bottom: EVALUATION_GAUGE_ANCHOR.y + GAUGE_BOX.y + GAUGE_BOX.height - 1,
} as const

/** 0x85944 — 값 칸 (x + G.x + G.w + 6, y + G.y + G.h − 8, 14, 10) */
export const EVALUATION_GAUGE_VALUE_BOX = {
  x: EVALUATION_GAUGE_ANCHOR.x + GAUGE_BOX.x + GAUGE_BOX.width + 6,
  y: EVALUATION_GAUGE_ANCHOR.y + GAUGE_BOX.y + GAUGE_BOX.height - 8,
  width: 14,
  height: 10,
} as const

/** 0x1400748(0xF7, 0x92, 0x00) — 부호 글 색 */
export const EVALUATION_GAUGE_SIGN_COLOR = '#F79200'

/** num 기준 0x50 — 숫자 80~89 (PNG 8×10, "1" 만 4×10) */
const DIGIT_BASE = 0x50
const digitWidthOf = (image: number) => (image === DIGIT_BASE + 1 ? 4 : 8)
/** 앱 글꼴 높이 +0x6c */
const FONT_HEIGHT = 11

export interface EvaluationGaugeState {
  /** +0x1d0 — 쌓인 줄 수 (0 이하면 안 그린다) */
  readonly current: number
  /** +0x1d4 */
  readonly step: 1 | -1
  /** +0x1d8 */
  readonly target: number
}

/** 0x8a816~0x8a81c 의 d — 타자편 6 · 투수편은 보직(0xb6705 = 레코드 +0xb & 3)이 0(선발)이면 12, 아니면 6 */
export function evaluationGaugeDivisorOf(side: { readonly kind: 'batter' } | { readonly kind: 'pitcher'; readonly role: number }): number {
  if (side.kind === 'batter') return 6
  return side.role !== 0 ? 6 : 12
}

/** 0x8587c */
export function startEvaluationGauge(popularityChange: number, divisor: number): EvaluationGaugeState {
  if (popularityChange >= 0) {
    return { current: 0, step: 1, target: Math.trunc((popularityChange * GAUGE_ROWS) / divisor) }
  }
  return { current: popularityChange === -1 ? 30 : 60, step: -1, target: popularityChange }
}

/** 0x858cc — 그린 뒤 한 걸음 */
export function tickEvaluationGauge(state: EvaluationGaugeState): EvaluationGaugeState {
  return state.current === state.target ? state : { ...state, current: state.current + state.step }
}

/** 0x847e0 의 채움 줄 y (맨 아래부터) */
export function evaluationGaugeRowsOf(state: EvaluationGaugeState): readonly number[] {
  return Array.from({ length: Math.max(0, state.current) }, (_unused, index) => EVALUATION_GAUGE_FILL.bottom - index)
}

export interface EvaluationGaugeValueLayout {
  readonly sign: '+' | '-'
  /** 부호 글자를 찍는 두 자리 (글자 왼쪽 위) */
  readonly signs: readonly { readonly x: number; readonly y: number }[]
  readonly digits: readonly { readonly image: number; readonly x: number; readonly y: number }[]
}

/** 0x85944 — 부호 두 번 + |v| 를 num 80~ 으로 오른쪽 맞춤 */
export function evaluationGaugeValueOf(popularityChange: number): EvaluationGaugeValueLayout {
  const box = EVALUATION_GAUGE_VALUE_BOX
  const sign = popularityChange >= 0 ? '+' : '-'
  // 0xba2e4 정렬 0x20: d = 칸 높이 − 글꼴 높이 → d > 0 이면 (d >> 1) + 나머지, 아니면 d >> 1
  const difference = box.height - FONT_HEIGHT
  const signY = box.y + (difference > 0 ? (difference >> 1) + (difference % 2) : difference >> 1)
  const signs = sign === '+'
    ? [{ x: box.x, y: signY }, { x: box.x + 1, y: signY }]
    : [{ x: box.x, y: signY }, { x: box.x, y: signY + 1 }]

  const magnitude = Math.abs(popularityChange)
  const images = [...String(magnitude)].map((digit) => DIGIT_BASE + Number(digit))
  const total = images.reduce((sum, image) => sum + digitWidthOf(image), 0)
  // 0xba51c 정렬 0x4: x += 칸 폭 − 폭(자간 0) · ox = |v| > 9 ? 5 : 0 · 0x10 은 세로를 건드리지 않는다
  let x = box.x + (magnitude > 9 ? 5 : 0) + box.width - total
  const digits = images.map((image) => {
    const placed = { image, x, y: box.y }
    x += digitWidthOf(image)
    return placed
  })
  return { sign, signs, digits }
}
