import { rgbOf565, rgbTo565 } from '@/shared/lib/screen565/screen565'
import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/effectNumbers'
import { brightenPixel565 } from '@/shared/lib/pixelEffect/colorEffects565'
import { effectPixel565, isEffectDrawn } from '@/shared/lib/pixelEffect/effectPixel565'

export const pixelOf = (rgba: ArrayLike<number>, at: number) => rgbTo565(rgba[at], rgba[at + 1], rgba[at + 2])

export function writePixel(rgba: Uint8ClampedArray, at: number, pixel: number, alpha = 255): void {
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
