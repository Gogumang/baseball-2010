/**
 * **그리기 효과의 픽셀 식 — 효과 번호별 공용 모듈** (2026-10-15 직접 뜸, 웹 round6-r75).
 *
 * 원본 그리기는 프레임 그리기 0xbe810 의 **효과 번호**로 갈리고, 번호마다 픽셀 함수가 시작 코드 0x3054~0x3120 에서 등록된다:
 * `0x985ed(k, 16비트판)` · `0x9869d(k, 팔레트판, 팔레트판2)` (R6 3a · 3b).
 * ```
 * 효과   16비트      팔레트 / 팔레트2     식 (모두 RGB565, 그림 픽셀이 투명이면 건너뜀)
 * 0      0x9a275    0x9a9b5 / 0x9aa1d    그대로 복사
 * 1      0x9a449    0x97769 / 0x9786d    반투명 단계 L(1~15): 표 0xd5e58(마스크) · 0xd5de0(밀기)로 화면 (16−L)/16 + 그림 L/16
 * 2      0x9a2f1    0x973c5 / 0x9754d    더하기 b(1~255): 채널마다 화면 + (그림·b) >> 8, 끝에서 자름 · b = 255 는 그냥 더하기
 * 4      0x9b1cd    0x98499 / 0x98511    흔들기 b: 줄마다 r = 난수(b + 1), 그림 칸 자리에 화면[x + r] 을 옮긴다
 * 0xa    0x9ae25    0x97f01 / 0x97f95    회색: s = R5 + G 위 5비트 + B5 + 3, g = s/4 + s/16 + s/64 (내림), g<<11 | g<<6 | g
 * 0xb    0x9ae95    0x98075 / 0x980d9    단색: 인자 색(565 아래 16비트)을 찍는다
 * 0xc    0x9af71    0x98351 / 0x983d1    반반: (그림 & 0xf7de) >> 1 + (색 & 0xf7de) >> 1 — 화면은 안 본다
 * 0xd    0x9aed9    0x98181 / 0x9823d    색 더하기: 채널마다 그림 + 인자 색, 끝에서 자름 — 화면은 안 본다
 * 0x10   0x9afd1    0x979d9 / 0x97abd    확대 · 축소 (자리 식은 프레임 0x944b4, R6 3b) — 픽셀 색은 그대로
 * 0x11   0x9b0e1    0x97c15 / 0x97d31    뒤집기 (R6 3b) — 픽셀 색은 그대로
 * ```
 * 따로 `0x987f9(k, …)` 표에 효과 0(0x9aac5 · 0x9b235) · 1(0x9a52d · 0x9b3f5)이 또 등록된다 — ⚠️ 미확인(어느 표면 길인지 안 봤다).
 *
 * 같은 식을 쓰는 다른 길:
 * - **0xc37a8** 흑백(화면 사각형을 제자리에서 회색으로) — 효과 0xa 와 같은 식(c3802~c382c).
 * - **0xbb91d** 종류 비트(홈런 글자 · 맞수 띠) — 4 회색(효과 0xa 식) · 8 밝게(채널 8비트에 +b, 255 자름) · 0x10 섞기 0xbb8d4 (R6 3c).
 *
 * 웹 그림은 565 를 비트 복제로 늘린 8비트라 `rgbTo565` 로 원래 값이 돌아온다. 결과는 다시 비트 복제로 편다(`rgbOf565`).
 * ⚠️ 8비트 → 565 (0x1400748) 와 화면 출력은 단말 몫이라 바이너리에 없다 — 위 비트를 남기는 보통 식으로 둔다.
 */
import { rgbOf565, rgbTo565 } from '@/shared/lib/screen565/screen565'

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

export type DrawEffect = (typeof DRAW_EFFECT)[keyof typeof DRAW_EFFECT]

/* ── 효과 1 반투명 ────────────────────────────────────────────────────────── */

/**
 * 표 0xd5e58 — 단계 L(1~15) 마다 u16 × 8. 앞 넷은 화면, 뒤 넷은 그림에 거는 채널 마스크다
 * (0xf7de · 0xe79c · 0xc718 · 0x8610 = ½ · ¼ · ⅛ · 1/16 용 — 밀기 전에 아래 비트를 떼어 채널끼리 안 섞이게 한다).
 */
export const TRANSLUCENT_MASKS: readonly (readonly number[])[] = [
  [0xf7de, 0xe79c, 0xc718, 0x8610, 0, 0, 0, 0x8610],
  [0xf7de, 0xe79c, 0xc718, 0, 0, 0, 0xc718, 0],
  [0xf7de, 0xe79c, 0, 0x8610, 0, 0, 0xc718, 0x8610],
  [0xf7de, 0xe79c, 0, 0, 0, 0xe79c, 0, 0],
  [0xf7de, 0, 0xc718, 0x8610, 0, 0xe79c, 0, 0x8610],
  [0xf7de, 0, 0xc718, 0, 0, 0xe79c, 0xc718, 0],
  [0xf7de, 0, 0, 0x8610, 0, 0xe79c, 0xc718, 0x8610],
  [0xf7de, 0, 0, 0, 0xf7de, 0, 0, 0],
  [0, 0xe79c, 0xc718, 0x8610, 0xf7de, 0, 0, 0x8610],
  [0, 0xe79c, 0xc718, 0, 0xf7de, 0, 0xc718, 0],
  [0, 0xe79c, 0, 0x8610, 0xf7de, 0, 0xc718, 0x8610],
  [0, 0xe79c, 0, 0, 0xf7de, 0xe79c, 0, 0],
  [0, 0, 0xc718, 0x8610, 0xf7de, 0xe79c, 0, 0x8610],
  [0, 0, 0xc718, 0, 0xf7de, 0xe79c, 0xc718, 0],
  [0, 0, 0, 0x8610, 0xf7de, 0xe79c, 0xc718, 0x8610],
]

/** 표 0xd5de0 — 단계마다 s8 × 8 (마스크와 짝인 오른쪽 밀기) */
export const TRANSLUCENT_SHIFTS: readonly (readonly number[])[] = [
  [1, 2, 3, 4, 0, 0, 0, 4],
  [1, 2, 3, 0, 0, 0, 3, 0],
  [1, 2, 0, 4, 0, 0, 3, 4],
  [1, 2, 0, 0, 0, 2, 0, 0],
  [1, 0, 3, 4, 0, 2, 0, 4],
  [1, 0, 3, 0, 0, 2, 3, 0],
  [1, 0, 0, 4, 0, 2, 3, 4],
  [1, 0, 0, 0, 1, 0, 0, 0],
  [0, 2, 3, 4, 1, 0, 0, 4],
  [0, 2, 3, 0, 1, 0, 3, 0],
  [0, 2, 0, 4, 1, 0, 3, 4],
  [0, 2, 0, 0, 1, 2, 0, 0],
  [0, 0, 3, 4, 1, 2, 0, 4],
  [0, 0, 3, 0, 1, 2, 3, 0],
  [0, 0, 0, 4, 1, 2, 3, 4],
]

/** 효과 1 이 그리는 단계 — 0x9a456~0x9a45c: 0 이나 15 넘으면 아무것도 안 한다. ⚠️ 음수 단계는 원본이 표 밖을 읽는다 — 안 그리는 것으로 둔다 */
export const isTranslucentLevelDrawn = (level: number) => Number.isInteger(level) && level >= 1 && level <= 15

/**
 * 효과 1 한 픽셀 — 0x9a48c~0x9a4ec:
 * `out = Σ_{i<4} (화면 & M[i]) >> S[i]  +  Σ_{i≥4} (그림 & M[i]) >> S[i]` (단계 L 의 줄).
 * 무게로 보면 화면 (16 − L)/16 · 그림 L/16 이지만 마스크마다 아래 비트를 버려 **내림이 여러 번** 들어간다.
 */
export function translucentPixel565(level: number, source: number, screen: number): number {
  if (!isTranslucentLevelDrawn(level)) return screen
  const masks = TRANSLUCENT_MASKS[level - 1]
  const shifts = TRANSLUCENT_SHIFTS[level - 1]
  let out = 0
  for (let index = 0; index < 8; index += 1) {
    const pixel = index < 4 ? screen : source
    out += (pixel & masks[index]) >> shifts[index]
  }
  return out & 0xffff
}

/**
 * DOM 겹치기용 효과 1 무게 — 그림 L/16.
 * ⚠️ 근사: CSS opacity 는 화면 픽셀을 모르는 채 8비트로 섞어 마스크 내림 · 565 양자화를 못 따른다(캔버스면 `drawImageWithEffect`).
 */
export const translucentOpacityOf = (level: number) => (isTranslucentLevelDrawn(level) ? level / 16 : 0)

/* ── 효과 2 더하기 ────────────────────────────────────────────────────────── */

/** 효과 2 가 그리는 인자 — 0x9a2fe~0x9a308: 0 이나 255 넘으면 안 그린다 */
export const isAdditiveWeightDrawn = (weight: number) => Number.isInteger(weight) && weight >= 1 && weight <= 0xff

/**
 * 효과 2 한 픽셀 — b = 255 는 0x9a324~0x9a376(채널끼리 그냥 더해 자름), 그 밖은 0x9a3ac~0x9a41c:
 * `R5 = min(31, 화면 R5 + (그림 R5 · b) >> 8)` · G6 은 63 · B5 는 31 에서 자른다.
 */
export function additivePixel565(weight: number, source: number, screen: number): number {
  if (!isAdditiveWeightDrawn(weight)) return screen
  const sr = source >> 11
  const sg = (source >> 5) & 0x3f
  const sb = source & 0x1f
  const add = (value: number) => (weight === 0xff ? value : (value * weight) >> 8)
  const r = Math.min(0x1f, (screen >> 11) + add(sr))
  const g = Math.min(0x3f, ((screen >> 5) & 0x3f) + add(sg))
  const b = Math.min(0x1f, (screen & 0x1f) + add(sb))
  return (r << 11) | (g << 5) | b
}

/* ── 효과 4 흔들기 ────────────────────────────────────────────────────────── */

/**
 * 0x9d469 — 원본 난수(전역 0x15606d4): `seed = seed · 0x343fd + 0x269ec3`, 값 = (seed << 1) >>> 17, 그 값 % n (n ≤ 0 이면 0).
 * 효과 4 는 줄마다 이 난수(b + 1)로 r 을 뽑는다. ⚠️ 원본은 전역 씨앗을 경기 난수와 같이 쓴다 — 웹은 씨앗을 넘겨받는다.
 */
export function nextOriginalRandom(seed: number, bound: number): { readonly seed: number; readonly value: number } {
  const next = (Math.imul(seed, 0x343fd) + 0x269ec3) | 0
  if (bound <= 0) return { seed, value: 0 }
  return { seed: next, value: ((next << 1) >>> 17) % bound }
}

/* ── 효과 0xa 회색 · 0xb 단색 · 0xc 반반 · 0xd 색 더하기 ─────────────────── */

/**
 * 효과 0xa (0x9ae48~0x9ae6c · 팔레트 0x97f01) · 0xc37a8 흑백 · 0xbb91d 종류 4 가 같이 쓰는 회색 식:
 * `s = R5 + G 위 5비트 + B5 + 3` · `g = s>>2 + s>>4 + s>>6` · `out = g<<11 | g<<6 | g` (G6 = g·2).
 */
export function grayPixel565(source: number): number {
  const sum = (source >> 11) + ((source >> 6) & 0x1f) + (source & 0x1f) + 3
  const gray = (sum >> 2) + (sum >> 4) + (sum >> 6)
  return ((gray << 11) | (gray << 6) | gray) & 0xffff
}

/** 효과 0xb (0x9aeb2 · 팔레트 0x980ba) — 그림 칸마다 인자 색의 아래 16비트를 그대로 찍는다 */
export const solidPixel565 = (color: number) => color & 0xffff

/** 효과 0xc (0x9af90~0x9afa8 · 팔레트 0x98394~0x983a8) — 그림과 인자 색을 채널마다 반씩 (아래 비트를 떼고 내림) */
export const halfMixPixel565 = (source: number, color: number) => (((source & 0xf7de) >> 1) + ((color & 0xf7de) >> 1)) & 0xffff

/**
 * 효과 0xd (0x9af04~0x9af4a · 팔레트 0x981c8~0x98214) — 그림 채널에 인자 색 채널을 더하고 끝에서 자른다.
 * 효과 0xd 의 인자가 0 이면 아무것도 안 그린다(0x9aee4).
 */
export function addColorPixel565(source: number, color: number): number {
  const r = Math.min(0x1f, (source >> 11) + ((color >> 11) & 0x1f))
  const g = Math.min(0x3f, ((source >> 5) & 0x3f) + ((color >> 5) & 0x3f))
  const b = Math.min(0x1f, (source & 0x1f) + (color & 0x1f))
  return (r << 11) | (g << 5) | b
}

/** 화면을 안 보는 효과 — 그림만 다시 칠하면 된다 */
export const isScreenIndependentEffect = (effect: number) =>
  effect === DRAW_EFFECT.COPY || effect === DRAW_EFFECT.GRAY || effect === DRAW_EFFECT.SOLID ||
  effect === DRAW_EFFECT.HALF_MIX || effect === DRAW_EFFECT.ADD_COLOR || effect === DRAW_EFFECT.SCALE ||
  effect === DRAW_EFFECT.FLIP

/** 이 효과 · 인자로 그림이 그려지는가 (인자 검사로 통째로 건너뛰는 경우) */
export function isEffectDrawn(effect: number, argument: number): boolean {
  if (effect === DRAW_EFFECT.TRANSLUCENT) return isTranslucentLevelDrawn(argument)
  if (effect === DRAW_EFFECT.ADDITIVE) return isAdditiveWeightDrawn(argument)
  if (effect === DRAW_EFFECT.JITTER) return argument !== 0
  if (effect === DRAW_EFFECT.ADD_COLOR) return argument !== 0
  return true
}

/**
 * 한 픽셀 — 그림 픽셀(투명 아님)과 그 자리 화면 픽셀로 새 화면 픽셀을 낸다. 효과 4(흔들기)는 줄 단위라 여기서 다루지 않는다.
 * 0x10 · 0x11 은 자리만 바꾸는 효과라 색은 그대로(복사)다.
 */
export function effectPixel565(effect: number, argument: number, source: number, screen: number): number {
  switch (effect) {
    case DRAW_EFFECT.TRANSLUCENT:
      return translucentPixel565(argument, source, screen)
    case DRAW_EFFECT.ADDITIVE:
      return additivePixel565(argument, source, screen)
    case DRAW_EFFECT.GRAY:
      return grayPixel565(source)
    case DRAW_EFFECT.SOLID:
      return solidPixel565(argument)
    case DRAW_EFFECT.HALF_MIX:
      return halfMixPixel565(source, argument)
    case DRAW_EFFECT.ADD_COLOR:
      return argument === 0 ? screen : addColorPixel565(source, argument)
    default:
      return source
  }
}

/* ── 0xbb91d 종류 비트 (R6 3c) ─────────────────────────────────────────────── */

/**
 * 0xbb91d 종류 8 밝게 (0xbbba6~0xbbbec) — 채널을 **비트 복제 없이** 8비트로 펴(`R8 = (p & 0xf800) >> 8` · `G8 = (p & 0x7e0) >> 3` ·
 * `B8 = (p & 0x1f) << 3`) b 를 더하고 255 에서 자른 뒤 0x1400748 로 565 를 만든다.
 */
export function brightenPixel565(source: number, amount: number): number {
  const r = Math.min(0xff, ((source & 0xf800) >> 8) + amount)
  const g = Math.min(0xff, ((source & 0x7e0) >> 3) + amount)
  const b = Math.min(0xff, ((source & 0x1f) << 3) + amount)
  return rgbTo565(r, g, b)
}

/**
 * 0xbb91d 종류 0x10 섞기 0xbb8d4(그림, 화면, b) — 채널마다 `그림·(32 − b) >> 5 + 화면·b >> 5`
 * (마스크 0xf81f07e0 · 0x07e0f81f 로 G 와 R·B 를 갈라 곱한다 — 16비트 값이라 위 반쪽은 비어 채널끼리 안 넘친다).
 */
export function blendPixel565(source: number, screen: number, weight: number): number {
  const part = (pixel: number, factor: number) =>
    ((((pixel & 0x7e0) >> 5) * factor) & 0xf81f07e0) | ((((pixel & 0xf81f) * factor) >> 5) & 0x07e0f81f)
  return (part(source, 32 - weight) + part(screen, weight)) & 0xffff
}

/* ── 0xc37a8 화면 사각형 흑백 ──────────────────────────────────────────────── */

/** 0xc37a8(x, y, w, h) — 화면 버퍼 사각형을 제자리에서 회색 식(`grayPixel565`)으로 바꾼다 */
export function grayRect565(pixels: Uint16Array, width: number, x: number, y: number, w: number, h: number): void {
  for (let row = 0; row < h; row += 1) {
    for (let column = 0; column < w; column += 1) {
      const at = (y + row) * width + x + column
      pixels[at] = grayPixel565(pixels[at])
    }
  }
}

/* ── RGBA (웹 그림) ────────────────────────────────────────────────────────── */

const pixelOf = (rgba: ArrayLike<number>, at: number) => rgbTo565(rgba[at], rgba[at + 1], rgba[at + 2])

function writePixel(rgba: Uint8ClampedArray, at: number, pixel: number, alpha = 255): void {
  const [r, g, b] = rgbOf565(pixel)
  rgba[at] = r
  rgba[at + 1] = g
  rgba[at + 2] = b
  rgba[at + 3] = alpha
}

/** 565 → CSS 색 (비트 복제로 편 8비트) */
export function css565(pixel: number): string {
  const [r, g, b] = rgbOf565(pixel)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * 단색 효과 0xb 의 CSS 색 — 원본 단색은 565 로 찍혀 아래 비트가 떨어진다(예: (0x80, 0x80, 0x80) → 0x8410 → (132, 130, 132)).
 * `#rrggbb` · `#rgb` · `rgb(r, g, b)` 를 받는다. 못 읽으면 받은 그대로.
 */
export function solidColorCss(color: string): string {
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color.trim())
  if (hex !== null) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    const value = Number.parseInt(digits, 16)
    return css565(rgbTo565((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff))
  }
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color.trim())
  if (rgb !== null) return css565(rgbTo565(Number(rgb[1]), Number(rgb[2]), Number(rgb[3])))
  return color
}

/**
 * 화면을 안 보는 효과(0 · 0xa · 0xb · 0xc · 0xd)를 그림 RGBA 에 입힌다 — 투명 칸(알파 0)은 그대로, 알파는 둔다.
 * 화면을 보는 효과(1 · 2 · 4)는 여기서 화면 0(검정)으로 계산된다 — 그런 효과는 `composeRgba` · `drawImageWithEffect` 를 쓴다.
 * ⚠️ 근사: 구운 PNG 의 반투명 칸(알파 1~254)은 원본 PZX 에 없다 — 색만 바꾸고 알파는 둔다.
 */
export function recolorRgba(rgba: ArrayLike<number>, effect: number, argument: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(rgba)
  // 인자 검사로 통째로 건너뛰면(효과 0xd · 인자 0 따위) 아무것도 안 그린다
  if (!isEffectDrawn(effect, argument)) return output.fill(0)
  for (let at = 0; at < output.length; at += 4) {
    if (output[at + 3] === 0) continue
    writePixel(output, at, effectPixel565(effect, argument, pixelOf(output, at), 0), output[at + 3])
  }
  return output
}

/** 0xbb91d 종류 8 밝게를 그림 RGBA 에 입힌다 (투명 칸 그대로) */
export function brightenRgba(rgba: ArrayLike<number>, amount: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(rgba)
  for (let at = 0; at < output.length; at += 4) {
    if (output[at + 3] === 0) continue
    writePixel(output, at, brightenPixel565(pixelOf(output, at), amount), output[at + 3])
  }
  return output
}

export interface RgbaSurface {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

/**
 * 그림을 화면 RGBA 의 (x, y) 에 효과로 그린다 — 화면을 고친다. 화면 밖은 자른다.
 * 화면 칸이 불투명(알파 255)이면 원본 식 그대로. 화면 칸이 비어 있으면(DOM 겹치기 캔버스의 빈 칸 — 아래 화면을 모른다)
 * ⚠️ 근사: 효과 1 은 그림 색에 알파 L/16, 효과 2 는 그림 색에 알파 b/256 으로 남긴다.
 * 효과 4 는 `random(bound)` 로 줄마다 r 을 뽑는다(원본 0x9b1ee 은 줄 머리에서 한 번).
 */
export function composeRgba(
  screen: RgbaSurface,
  sprite: RgbaSurface,
  x: number,
  y: number,
  effect: number,
  argument: number,
  random: (bound: number) => number = (bound) => Math.floor(Math.random() * bound),
): void {
  if (!isEffectDrawn(effect, argument)) return
  const out = screen.data
  for (let row = 0; row < sprite.height; row += 1) {
    const sy = y + row
    if (sy < 0 || sy >= screen.height) continue
    const shift = effect === DRAW_EFFECT.JITTER ? random(argument + 1) : 0
    for (let column = 0; column < sprite.width; column += 1) {
      const sx = x + column
      if (sx < 0 || sx >= screen.width) continue
      const from = (row * sprite.width + column) * 4
      if (sprite.data[from + 3] === 0) continue
      const at = (sy * screen.width + sx) * 4
      if (effect === DRAW_EFFECT.JITTER) {
        // 9b200 화면[x] = 화면[x + r] — 같은 줄 버퍼를 앞으로 읽는다(줄 끝을 넘으면 다음 줄)
        const take = at + shift * 4
        if (take + 3 < out.length) out.copyWithin(at, take, take + 4)
        continue
      }
      const source = pixelOf(sprite.data, from)
      if (out[at + 3] === 255 || isScreenIndependentEffect(effect)) {
        writePixel(out, at, effectPixel565(effect, argument, source, pixelOf(out, at)))
        continue
      }
      if (out[at + 3] === 0) {
        const alpha = effect === DRAW_EFFECT.TRANSLUCENT ? (argument * 255) / 16 : (argument * 255) / 256
        writePixel(out, at, source, Math.round(alpha))
        continue
      }
      // ⚠️ 근사: 반투명 화면 칸 — 색은 원본 식, 알파는 그대로
      writePixel(out, at, effectPixel565(effect, argument, source, pixelOf(out, at)), out[at + 3])
    }
  }
}

/* ── 캔버스 ────────────────────────────────────────────────────────────────── */

type DrawableImage = HTMLImageElement | HTMLCanvasElement

function rgbaOfImage(image: DrawableImage): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context === null || image.width === 0 || image.height === 0) return null
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, image.width, image.height)
}

/**
 * 캔버스에 그림을 효과로 그린다 — 그 자리 화면을 읽어(`getImageData`) `composeRgba` 로 섞고 다시 놓는다.
 * 좌표는 정수로 내린다(원본 화면 좌표는 정수다).
 * 변환(scale · translate)이 걸려 캔버스 칸이 화면 칸과 안 맞으면 ⚠️ 근사로 그린다 — 화면을 안 보는 효과는 다시 칠한 그림,
 * 효과 1 은 globalAlpha L/16, 효과 2 는 'lighter' · globalAlpha b/256.
 */
export function drawImageWithEffect(
  context: CanvasRenderingContext2D,
  image: DrawableImage,
  x: number,
  y: number,
  effect: number,
  argument: number,
): void {
  if (!isEffectDrawn(effect, argument)) return
  if (!context.getTransform().isIdentity) {
    drawApproximately(context, image, x, y, effect, argument)
    return
  }
  const sprite = rgbaOfImage(image)
  if (sprite === null) return
  const left = Math.max(0, Math.floor(x))
  const top = Math.max(0, Math.floor(y))
  const right = Math.min(context.canvas.width, Math.floor(x) + image.width)
  const bottom = Math.min(context.canvas.height, Math.floor(y) + image.height)
  if (right <= left || bottom <= top) return
  const region = context.getImageData(left, top, right - left, bottom - top)
  composeRgba(
    { data: region.data, width: region.width, height: region.height },
    { data: sprite.data, width: sprite.width, height: sprite.height },
    Math.floor(x) - left,
    Math.floor(y) - top,
    effect,
    argument,
  )
  context.putImageData(region, left, top)
}

/** 변환이 걸린 캔버스용 근사 그리기 (`drawImageWithEffect` 머리 참고) */
function drawApproximately(
  context: CanvasRenderingContext2D,
  image: DrawableImage,
  x: number,
  y: number,
  effect: number,
  argument: number,
): void {
  if (isScreenIndependentEffect(effect)) {
    context.drawImage(recoloredImageOf(image, effect, argument), x, y)
    return
  }
  if (effect !== DRAW_EFFECT.TRANSLUCENT && effect !== DRAW_EFFECT.ADDITIVE) return
  context.save()
  if (effect === DRAW_EFFECT.ADDITIVE) context.globalCompositeOperation = 'lighter'
  context.globalAlpha *= effect === DRAW_EFFECT.TRANSLUCENT ? translucentOpacityOf(argument) : argument / 256
  context.drawImage(image, x, y)
  context.restore()
}

const recolorCache = new Map<string, HTMLCanvasElement>()

/** 그림을 다시 칠한 캔버스 — 키가 있으면(이미지 주소가 있으면) 한 번만 칠한다 */
function paintedCanvasOf(
  image: DrawableImage,
  key: string | null,
  paint: (rgba: Uint8ClampedArray) => Uint8ClampedArray,
): DrawableImage {
  const cached = key === null ? undefined : recolorCache.get(key)
  if (cached !== undefined) return cached
  const pixels = rgbaOfImage(image)
  if (pixels === null) return image
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context === null) return image
  pixels.data.set(paint(pixels.data))
  context.putImageData(pixels, 0, 0)
  if (key !== null) recolorCache.set(key, canvas)
  return canvas
}

const sourceKeyOf = (image: DrawableImage, suffix: string) =>
  image instanceof HTMLImageElement && image.src !== '' ? `${image.src}#${suffix}` : null

/** 화면을 안 보는 효과(0 · 0xa · 0xb · 0xc · 0xd)를 입힌 그림 */
export const recoloredImageOf = (image: DrawableImage, effect: number, argument: number): DrawableImage =>
  paintedCanvasOf(image, sourceKeyOf(image, `e${effect}:${argument}`), (rgba) => recolorRgba(rgba, effect, argument))

/** 0xbb91d 종류 8 밝게를 입힌 그림 */
export const brightenedImageOf = (image: DrawableImage, amount: number): DrawableImage =>
  paintedCanvasOf(image, sourceKeyOf(image, `b${amount}`), (rgba) => brightenRgba(rgba, amount))

/* ── 주소 (DOM <img>) ──────────────────────────────────────────────────────── */

const urlCache = new Map<string, Promise<string>>()

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`그림을 불러오지 못했습니다: ${url}`))
    image.src = url
  })
}

async function paintUrl(url: string, effect: number, argument: number): Promise<string> {
  const image = await loadImage(url)
  const pixels = rgbaOfImage(image)
  if (pixels === null) return url
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context === null) return url
  pixels.data.set(recolorRgba(pixels.data, effect, argument))
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL('image/png')
}

/** 화면을 안 보는 효과를 입힌 그림 주소(data URL). 같은 그림 · 효과 · 인자는 한 번만 칠한다. 실패하면 원래 주소 */
export function effectSpriteUrl(url: string, effect: number, argument: number): Promise<string> {
  const key = `${url}#${effect}:${argument}`
  const cached = urlCache.get(key)
  if (cached !== undefined) return cached
  const request = paintUrl(url, effect, argument).catch(() => url)
  urlCache.set(key, request)
  return request
}
