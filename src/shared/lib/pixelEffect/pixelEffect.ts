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
 * 따로 `0x987f9(k, 몸통, 감싸개)` 표(0x3110 · 0x3118)는 **그림 효과가 아니라 단계 덮기**(사각형 칠하기)다 — 2026-10-15 직접 뜸(웹 r83):
 * k = 0 → [0x15605e4] = 0x9aac4 몸통 · [0x15605d4] = 0x9b234 검정 덮기, k = 1 → [0x15605e0] = 0x9a52c 몸통 · [0x15605d0] = 0x9b3f4 색 덮기.
 * 몸통 칸은 감싸개만 읽는다(0x9b248 · 0x9b3aa → +0x5e4, 0x9b408 · 0x9b562 → +0x5e0). k = 2 · 3 칸(+0x5dc · +0x5d8 · +0x5cc)은
 * 0x987f8 밖에서 읽는 곳도 거는 곳도 없다. 덮기 식과 쓰는 곳(창 뒤 어둡게 0x746cc · 결과 패배 0x4a384 · 스토리 0xbd844 …)은 `shared/lib/stepCover`.
 *
 * 같은 식을 쓰는 다른 길:
 * - **0xc37a8** 흑백(화면 사각형을 제자리에서 회색으로) — 효과 0xa 와 같은 식(c3802~c382c). 커맨드 줄 0x7e418 · 필살 창 0x803d4 ·
 *   0x882b4 가 함수 포인터로 부른다. 이미 그린 **화면**을 바꾸므로 DOM 은 그 사각형 안의 겹마다 회색 그림을 잘라 다시 얹는다
 *   (겹이 불투명 복사라 `회색(겹친 결과) = 겹친 결과(회색 겹)`).
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
 * ⚠️ 근사(남김 — 웹 DOM 한계): CSS opacity 는 화면 픽셀을 모르는 채 8비트로 섞어 마스크 내림 · 565 양자화를 못 따른다(캔버스면 `drawImageWithEffect`).
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
  const pixel = color565Of(color)
  return pixel === null ? color : css565(pixel)
}

/** CSS 색(`#rrggbb` · `#rgb` · `rgb(r, g, b)`)을 565 로 — 못 읽으면 null */
export function color565Of(color: string): number | null {
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color.trim())
  if (hex !== null) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    const value = Number.parseInt(digits, 16)
    return rgbTo565((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff)
  }
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color.trim())
  if (rgb !== null) return rgbTo565(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]))
  return null
}

/**
 * 화면을 안 보는 효과(0 · 0xa · 0xb · 0xc · 0xd)를 그림 RGBA 에 입힌다 — 투명 칸(알파 0)은 그대로, 알파는 둔다.
 * 화면을 보는 효과(1 · 2 · 4)는 여기서 화면 0(검정)으로 계산된다 — 그런 효과는 `composeRgba` · `drawImageWithEffect` 를 쓴다.
 * ⚠️ 근사(남김 — 웹 DOM 한계): 구운 PNG 의 반투명 칸(알파 1~254)은 원본 PZX 에 없다 — 색만 바꾸고 알파는 둔다.
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

/**
 * 그림 아래 화면이 **한 가지 색**(565 `backdrop`)일 때 — 화면을 보는 효과(1 · 2)까지 원본 식 그대로 칠한 그림 RGBA.
 * 그림이 덮는 칸은 `효과(그림, 바탕)` 으로 불투명하게, 투명 칸은 투명하게 둔다(그 자리는 DOM 바탕이 그대로 보인다 — 원본도 화면 그대로).
 * 인자 검사로 통째로 안 그리면 모두 투명. 효과 4(흔들기)는 이웃 화면 칸을 옮기는데 바탕이 한 색이라 바탕 색 그대로다.
 */
export function composeOverSolidRgba(rgba: ArrayLike<number>, effect: number, argument: number, backdrop: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(rgba)
  if (!isEffectDrawn(effect, argument)) return output.fill(0)
  for (let at = 0; at < output.length; at += 4) {
    if (output[at + 3] === 0) continue
    const pixel = effect === DRAW_EFFECT.JITTER ? backdrop : effectPixel565(effect, argument, pixelOf(output, at), backdrop)
    writePixel(output, at, pixel)
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
 * ⚠️ 근사(남김 — 웹 DOM 한계): 효과 1 은 그림 색에 알파 L/16, 효과 2 는 그림 색에 알파 b/256 으로 남긴다.
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
      // ⚠️ 근사(남김 — 웹 DOM 한계): 반투명 화면 칸 — 색은 원본 식, 알파는 그대로
      writePixel(out, at, effectPixel565(effect, argument, source, pixelOf(out, at)), out[at + 3])
    }
  }
}

/* ── 캔버스 ────────────────────────────────────────────────────────────────── */

type DrawableImage = HTMLImageElement | HTMLCanvasElement

/**
 * 화면 칸을 읽는(`drawImageWithEffect`) 캔버스의 2D 문맥 옵션 — 읽기가 잦다고 알려 CPU 버퍼에 둔다.
 * GPU 가속 캔버스는 `getImageData` 마다 GPU→CPU 동기 읽기가 걸린다. 픽셀 값은 바뀌지 않는다(저장 위치만 다르다).
 * ⚠️ 캔버스의 **첫** `getContext` 가 옵션을 정한다 — 그 캔버스를 여는 모든 자리가 이 옵션으로 열어야 한다.
 */
export const EFFECT_CONTEXT_OPTIONS: CanvasRenderingContext2DSettings = { willReadFrequently: true }

/** 효과로 그릴 캔버스의 2D 문맥 (`EFFECT_CONTEXT_OPTIONS`) */
export const effectContextOf = (canvas: HTMLCanvasElement | null | undefined): CanvasRenderingContext2D | null =>
  canvas?.getContext('2d', EFFECT_CONTEXT_OPTIONS) ?? null

function rgbaOfImage(image: DrawableImage): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', EFFECT_CONTEXT_OPTIONS)
  if (context === null || image.width === 0 || image.height === 0) return null
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, image.width, image.height)
}

/**
 * 키(그림)마다 한 번 읽어 두는 캐시 — `signatureOf` 가 null 이면 캐시하지 않고(바뀔 수 있는 그림) 매번 읽는다.
 * 같은 그림이라도 서명(크기 · 주소)이 바뀌면 다시 읽는다. 읽기가 null(아직 못 읽음)이면 남기지 않는다.
 */
export function createReadCache<K extends object, V>(
  read: (key: K) => V | null,
  signatureOf: (key: K) => string | null,
): (key: K) => V | null {
  const entries = new WeakMap<K, { readonly signature: string; readonly value: V }>()
  return (key) => {
    const signature = signatureOf(key)
    if (signature === null) return read(key)
    const hit = entries.get(key)
    if (hit !== undefined && hit.signature === signature) return hit.value
    const value = read(key)
    if (value === null) entries.delete(key)
    else entries.set(key, { signature, value })
    return value
  }
}

/** 다 그린 뒤 다시 안 그리는 캔버스 — 픽셀을 캐시해도 된다(`markCanvasImmutable`) */
const immutableCanvases = new WeakSet<HTMLCanvasElement>()

/** 이 캔버스는 이제 안 바뀐다 — `drawImageWithEffect` 가 그 픽셀을 한 번만 읽는다 */
export function markCanvasImmutable(canvas: HTMLCanvasElement): void {
  immutableCanvases.add(canvas)
}

/**
 * 그림 RGBA 를 그림마다 한 번만 읽는다 — 다 받은 `<img>`(주소 · 크기로 서명) 와 안 바뀌는 캔버스만 캐시한다.
 * 받는 중인 `<img>` · 그냥 캔버스는 지금처럼 매번 읽는다. 돌려준 버퍼는 **읽기 전용**이다.
 */
const spriteRgbaOf = createReadCache<DrawableImage, ImageData>(rgbaOfImage, (image) => {
  if (image.width === 0 || image.height === 0) return null
  if (image instanceof HTMLImageElement) {
    if (!image.complete || image.naturalWidth === 0) return null
    return `${image.width}x${image.height}@${image.naturalWidth}x${image.naturalHeight}:${image.currentSrc || image.src}`
  }
  return immutableCanvases.has(image) ? `${image.width}x${image.height}` : null
})

/** 효과 그리기 한 번 — 그림 RGBA · 화면 좌표(정수로 내린다) */
export interface EffectDraw {
  readonly sprite: RgbaSurface
  readonly x: number
  readonly y: number
  readonly effect: number
  readonly argument: number
}

interface PixelRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** 화면(width × height) 안으로 자른 그리기 칸 — 안 보이면 null */
function clippedRectOf(draw: EffectDraw, width: number, height: number): PixelRect | null {
  const x = Math.floor(draw.x)
  const y = Math.floor(draw.y)
  const rect = {
    left: Math.max(0, x),
    top: Math.max(0, y),
    right: Math.min(width, x + draw.sprite.width),
    bottom: Math.min(height, y + draw.sprite.height),
  }
  return rect.right <= rect.left || rect.bottom <= rect.top ? null : rect
}

const overlaps = (a: PixelRect, b: PixelRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** 칸 묶음의 테두리 */
function boundsOf(rects: readonly PixelRect[]): PixelRect {
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  }
}

/** 버퍼 칸 안이 모두 불투명(알파 255)인가 */
function isOpaque(surface: RgbaSurface, rect: PixelRect, origin: PixelRect): boolean {
  for (let row = rect.top; row < rect.bottom; row += 1) {
    let at = ((row - origin.top) * surface.width + (rect.left - origin.left)) * 4 + 3
    for (let column = rect.left; column < rect.right; column += 1, at += 4) if (surface.data[at] !== 255) return false
  }
  return true
}

/** `drawImageWithEffect` 가 쓰는 캔버스 쪽 — 시험에서 가짜로 바꿔 끼운다 */
export type EffectCanvasContext = Pick<CanvasRenderingContext2D, 'getImageData' | 'putImageData'> & {
  readonly canvas: { readonly width: number; readonly height: number }
}

/**
 * 그림 RGBA 를 캔버스에 효과로 그린다(변환 없는 캔버스) — 그 자리 화면을 읽어(`getImageData`) `composeRgba` 로 섞고 다시 놓는다.
 * 좌표는 정수로 내린다(원본 화면 좌표는 정수다).
 */
export function drawRgbaWithEffect(context: EffectCanvasContext, draw: EffectDraw): void {
  if (!isEffectDrawn(draw.effect, draw.argument)) return
  const rect = clippedRectOf(draw, context.canvas.width, context.canvas.height)
  if (rect === null) return
  const region = context.getImageData(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
  composeRgba(
    { data: region.data, width: region.width, height: region.height },
    draw.sprite,
    Math.floor(draw.x) - rect.left,
    Math.floor(draw.y) - rect.top,
    draw.effect,
    draw.argument,
  )
  context.putImageData(region, rect.left, rect.top)
}

/**
 * 효과 그리기 여럿을 차례대로 — `drawRgbaWithEffect` 를 하나씩 부른 것과 **같은 픽셀**을 내되 화면 읽기 · 쓰기를 모은다.
 *
 * - 모두의 테두리를 한 번 읽는다. 그 칸이 다 불투명하면 버퍼 위에서 차례대로 섞고 한 번 놓는다
 *   (불투명 칸은 읽기 · 놓기 왕복이 값을 안 바꾸고, 불투명 화면에 섞은 결과도 불투명이다 — 하나씩 그린 것과 같다).
 * - 투명 · 반투명 칸이 있으면(겹치기 층) 왕복이 반투명 값을 반올림할 수 있다 — 그래서 **서로 안 겹치는** 이어진 그리기끼리만
 *   한 번 읽은 버퍼에서 섞고, 저마다 제 칸만(dirty 사각형) 놓는다. 겹치면 그 앞에서 끊고 다시 읽는다.
 * - 효과 4(흔들기)는 버퍼 줄 끝을 넘어 읽어 읽은 칸 크기에 따라 결과가 달라진다 — 그 앞뒤로 끊어 하나씩 그린다.
 */
export function drawRgbasWithEffect(context: EffectCanvasContext, draws: readonly EffectDraw[]): void {
  const { width, height } = context.canvas
  const pending: { readonly draw: EffectDraw; readonly rect: PixelRect }[] = []
  for (const draw of draws) {
    if (!isEffectDrawn(draw.effect, draw.argument)) continue
    if (draw.effect === DRAW_EFFECT.JITTER) {
      flushEffectDraws(context, pending.splice(0))
      drawRgbaWithEffect(context, draw)
      continue
    }
    const rect = clippedRectOf(draw, width, height)
    if (rect !== null) pending.push({ draw, rect })
  }
  flushEffectDraws(context, pending)
}

function flushEffectDraws(
  context: EffectCanvasContext,
  pending: readonly { readonly draw: EffectDraw; readonly rect: PixelRect }[],
): void {
  let start = 0
  while (start < pending.length) {
    const bounds = boundsOf(pending.slice(start).map((item) => item.rect))
    const region = context.getImageData(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top)
    const surface = { data: region.data, width: region.width, height: region.height }
    const composeAt = (draw: EffectDraw) =>
      composeRgba(surface, draw.sprite, Math.floor(draw.x) - bounds.left, Math.floor(draw.y) - bounds.top, draw.effect, draw.argument)
    if (isOpaque(surface, bounds, bounds)) {
      for (let index = start; index < pending.length; index += 1) composeAt(pending[index].draw)
      context.putImageData(region, bounds.left, bounds.top)
      return
    }
    // 서로 안 겹치는 이어진 그리기 — 이 버퍼(읽은 그대로의 화면)에서 섞고 제 칸만 놓는다
    let end = start
    while (end < pending.length && pending.slice(start, end).every((item) => !overlaps(item.rect, pending[end].rect))) end += 1
    for (let index = start; index < end; index += 1) {
      const { draw, rect } = pending[index]
      composeAt(draw)
      context.putImageData(region, bounds.left, bounds.top,
        rect.left - bounds.left, rect.top - bounds.top, rect.right - rect.left, rect.bottom - rect.top)
    }
    start = end
  }
}

/**
 * 캔버스에 그림을 효과로 그린다 — 그 자리 화면을 읽어(`getImageData`) `composeRgba` 로 섞고 다시 놓는다.
 * 좌표는 정수로 내린다(원본 화면 좌표는 정수다). 그림 RGBA 는 그림마다 한 번만 읽는다(`spriteRgbaOf`).
 * 변환(scale · translate)이 걸려 캔버스 칸이 화면 칸과 안 맞으면 ⚠️ 근사(남김 — 웹 DOM 한계)로 그린다 — 화면을 안 보는 효과는 다시 칠한 그림,
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
  drawImagesWithEffect(context, [{ image, x, y, effect, argument }])
}

/** 효과 그리기 한 번 — 그림 · 화면 좌표 */
export interface ImageEffectDraw {
  readonly image: DrawableImage
  readonly x: number
  readonly y: number
  readonly effect: number
  readonly argument: number
}

/**
 * `drawImageWithEffect` 를 차례대로 여러 번 부른 것과 같다 — 변환 없는 캔버스면 화면 읽기 · 쓰기를 모은다(`drawRgbasWithEffect`).
 */
export function drawImagesWithEffect(context: CanvasRenderingContext2D, draws: readonly ImageEffectDraw[]): void {
  const shown = draws.filter((draw) => isEffectDrawn(draw.effect, draw.argument))
  if (shown.length === 0) return
  if (!context.getTransform().isIdentity) {
    for (const draw of shown) drawApproximately(context, draw.image, draw.x, draw.y, draw.effect, draw.argument)
    return
  }
  const rgbaDraws: EffectDraw[] = []
  for (const draw of shown) {
    const sprite = spriteRgbaOf(draw.image)
    if (sprite !== null) rgbaDraws.push({ sprite, x: draw.x, y: draw.y, effect: draw.effect, argument: draw.argument })
  }
  if (rgbaDraws.length === 1) drawRgbaWithEffect(context, rgbaDraws[0])
  else drawRgbasWithEffect(context, rgbaDraws)
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
  markCanvasImmutable(canvas)
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

/**
 * 0xbb91d 종류 0x12 — 종류 2 크기 a/10 배(0xbb9d2~0xbb9f0: 그린 폭 = w·a/10 · 0xbbabc~0xbbacc: 원본 줄 = 그린 줄·10/a, a 가 20 이면
 * 시프트) · 종류 0x10 화면 섞기 0xbb8d4(b, `blendPixel565`). 투명 칸(풀어 둔 자홍 0xbbb4e~0xbbb5e)은 건너뛴다.
 * 그 자리 화면을 읽어 섞고 다시 놓는다. 변환이 걸린 캔버스는 ⚠️ 근사(globalAlpha (32 − b · 남김 — 웹 DOM 한계)/32 · 최근접 키우기).
 * 화면 칸이 비어 있으면(겹치기 층) 그림 색에 알파 (32 − b)/32 로 남긴다(⚠️ 근사(남김 — 웹 DOM 한계) — `composeRgba` 와 같은 처리).
 */
export function drawImageScaledBlend(
  context: CanvasRenderingContext2D,
  image: DrawableImage,
  x: number,
  y: number,
  scaleTenths: number,
  weight: number,
): void {
  const width = Math.trunc((image.width * scaleTenths) / 10)
  const height = Math.trunc((image.height * scaleTenths) / 10)
  if (width <= 0 || height <= 0) return
  if (!context.getTransform().isIdentity) {
    context.save()
    context.imageSmoothingEnabled = false
    context.globalAlpha *= (32 - weight) / 32
    context.drawImage(image, x, y, width, height)
    context.restore()
    return
  }
  const sprite = spriteRgbaOf(image)
  if (sprite === null) return
  const originX = Math.floor(x)
  const originY = Math.floor(y)
  const left = Math.max(0, originX)
  const top = Math.max(0, originY)
  const right = Math.min(context.canvas.width, originX + width)
  const bottom = Math.min(context.canvas.height, originY + height)
  if (right <= left || bottom <= top) return
  const region = context.getImageData(left, top, right - left, bottom - top)
  const out = region.data
  for (let row = top; row < bottom; row += 1) {
    const sourceRow = Math.trunc(((row - originY) * 10) / scaleTenths)
    for (let column = left; column < right; column += 1) {
      const sourceColumn = Math.trunc(((column - originX) * 10) / scaleTenths)
      const from = (sourceRow * sprite.width + sourceColumn) * 4
      if (sprite.data[from + 3] === 0) continue
      const at = ((row - top) * region.width + (column - left)) * 4
      const source = pixelOf(sprite.data, from)
      if (out[at + 3] === 0) {
        writePixel(out, at, source, Math.round(((32 - weight) * 255) / 32))
        continue
      }
      writePixel(out, at, blendPixel565(source, pixelOf(out, at), weight), out[at + 3])
    }
  }
  context.putImageData(region, left, top)
}

/* ── 주소 (DOM <img>) ──────────────────────────────────────────────────────── */

const urlCache = new Map<string, Promise<string>>()
/** 다 칠한 주소 — 같은 그림을 다시 쓰는 자리(움직이는 바탕 따위)가 한 틀도 비지 않게 바로 꺼낸다 */
const paintedUrls = new Map<string, string>()

const effectSpriteKeyOf = (url: string, effect: number, argument: number, backdrop: number | null) =>
  `${url}#${effect}:${argument}${backdrop === null ? '' : `@${backdrop}`}`

/** 이미 칠해 둔 주소 — 아직이면 null */
export const paintedEffectSpriteUrlOf = (url: string, effect: number, argument: number, backdrop: number | null = null): string | null =>
  paintedUrls.get(effectSpriteKeyOf(url, effect, argument, backdrop)) ?? null

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`그림을 불러오지 못했습니다: ${url}`))
    image.src = url
  })
}

async function paintUrl(url: string, effect: number, argument: number, backdrop: number | null): Promise<string> {
  const image = await loadImage(url)
  const pixels = rgbaOfImage(image)
  if (pixels === null) return url
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context === null) return url
  pixels.data.set(backdrop === null
    ? recolorRgba(pixels.data, effect, argument)
    : composeOverSolidRgba(pixels.data, effect, argument, backdrop))
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * 화면을 안 보는 효과를 입힌 그림 주소(data URL). 같은 그림 · 효과 · 인자(· 바탕)는 한 번만 칠한다. 실패하면 원래 주소.
 * `backdrop`(565)을 주면 그 한 색 화면 위에 그린 결과(`composeOverSolidRgba`) — 화면을 보는 효과 1 · 2 도 원본 식 그대로다.
 */
export function effectSpriteUrl(url: string, effect: number, argument: number, backdrop: number | null = null): Promise<string> {
  const key = effectSpriteKeyOf(url, effect, argument, backdrop)
  const cached = urlCache.get(key)
  if (cached !== undefined) return cached
  const request = paintUrl(url, effect, argument, backdrop).catch(() => url).then((painted) => {
    paintedUrls.set(key, painted)
    return painted
  })
  urlCache.set(key, request)
  return request
}
