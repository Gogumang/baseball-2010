/** 프레임 그리기 효과 번호 (0xbe810 그리기 칸 +0x18) */
export const DRAW_EFFECT = {
  COPY: 0,
  TRANSLUCENT: 1,
  ADDITIVE: 2,
  JITTER: 4,
  GRAY: 0xa,
  SOLID: 0xb,
  HALF_MIX: 0xc,
  ADD_COLOR: 0xd,
  SCALE: 0x10,
  FLIP: 0x11,
} as const

/** 화면을 안 보는 효과 — 그림만 다시 칠하면 된다 */
export const isScreenIndependentEffect = (effect: number) =>
  effect === DRAW_EFFECT.COPY ||
  effect === DRAW_EFFECT.GRAY ||
  effect === DRAW_EFFECT.SOLID ||
  effect === DRAW_EFFECT.HALF_MIX ||
  effect === DRAW_EFFECT.ADD_COLOR ||
  effect === DRAW_EFFECT.SCALE ||
  effect === DRAW_EFFECT.FLIP
