import { rgbTo565 } from '@/shared/lib/screen565/screen565'

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

/**
 * 0x9d469 — 원본 난수(전역 0x15606d4): `seed = seed · 0x343fd + 0x269ec3`, 값 = (seed << 1) >>> 17, 그 값 % n (n ≤ 0 이면 0).
 * 효과 4 는 줄마다 이 난수(b + 1)로 r 을 뽑는다. ⚠️ 원본은 전역 씨앗을 경기 난수와 같이 쓴다 — 웹은 씨앗을 넘겨받는다.
 */
export function nextOriginalRandom(seed: number, bound: number): { readonly seed: number; readonly value: number } {
  const next = (Math.imul(seed, 0x343fd) + 0x269ec3) | 0
  if (bound <= 0) return { seed, value: 0 }
  return { seed: next, value: ((next << 1) >>> 17) % bound }
}

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
  const part = (pixel: number, factor: number) => ((((pixel & 0x7e0) >> 5) * factor) & 0xf81f07e0) | ((((pixel & 0xf81f) * factor) >> 5) & 0x07e0f81f)
  return (part(source, 32 - weight) + part(screen, weight)) & 0xffff
}

/** 0xc37a8(x, y, w, h) — 화면 버퍼 사각형을 제자리에서 회색 식(`grayPixel565`)으로 바꾼다 */
export function grayRect565(pixels: Uint16Array, width: number, x: number, y: number, w: number, h: number): void {
  for (let row = 0; row < h; row += 1) {
    for (let column = 0; column < w; column += 1) {
      const at = (y + row) * width + x + column
      pixels[at] = grayPixel565(pixels[at])
    }
  }
}
