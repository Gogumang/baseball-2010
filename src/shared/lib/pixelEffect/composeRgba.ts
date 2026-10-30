import { DRAW_EFFECT, isScreenIndependentEffect } from '@/shared/lib/pixelEffect/effectNumbers'
import { effectPixel565, isEffectDrawn } from '@/shared/lib/pixelEffect/effectPixel565'
import { pixelOf, writePixel } from '@/shared/lib/pixelEffect/rgbaEffects'

export interface RgbaSurface {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

/** 화면 칸이 비었을 때(겹치기 층) 남기는 알파 — 효과 1 은 L/16, 그 밖(효과 2)은 b/256 */
function emptyScreenAlphaOf(effect: number, argument: number): number {
  return effect === DRAW_EFFECT.TRANSLUCENT ? (argument * 255) / 16 : (argument * 255) / 256
}

/** 그림 칸 하나를 화면 칸에 섞는다 — 불투명 화면 · 화면을 안 보는 효과는 원본 식, 빈 칸은 그림 색에 알파, 반투명 칸은 색만 원본 식 */
function blendRgbaPixel(out: Uint8ClampedArray, at: number, source: number, effect: number, argument: number): void {
  if (out[at + 3] === 255 || isScreenIndependentEffect(effect)) {
    writePixel(out, at, effectPixel565(effect, argument, source, pixelOf(out, at)))
    return
  }
  if (out[at + 3] === 0) {
    writePixel(out, at, source, Math.round(emptyScreenAlphaOf(effect, argument)))
    return
  }
  // ⚠️ 근사(남김 — 웹 DOM 한계): 반투명 화면 칸 — 색은 원본 식, 알파는 그대로
  writePixel(out, at, effectPixel565(effect, argument, source, pixelOf(out, at)), out[at + 3])
}

/** 9b200 화면[x] = 화면[x + r] — 같은 줄 버퍼를 앞으로 읽는다(줄 끝을 넘으면 다음 줄) */
function jitterRgbaPixel(out: Uint8ClampedArray, at: number, shift: number): void {
  const take = at + shift * 4
  if (take + 3 < out.length) out.copyWithin(at, take, take + 4)
}

/** 그림 한 줄(row)을 화면 줄 sy 에 — 화면 밖 칸 · 투명 칸은 건너뛴다 */
function composeRgbaRow(
  screen: RgbaSurface,
  sprite: RgbaSurface,
  row: number,
  sy: number,
  x: number,
  effect: number,
  argument: number,
  shift: number,
): void {
  const out = screen.data
  for (let column = 0; column < sprite.width; column += 1) {
    const sx = x + column
    if (sx < 0 || sx >= screen.width) continue
    const from = (row * sprite.width + column) * 4
    if (sprite.data[from + 3] === 0) continue
    const at = (sy * screen.width + sx) * 4
    if (effect === DRAW_EFFECT.JITTER) jitterRgbaPixel(out, at, shift)
    else blendRgbaPixel(out, at, pixelOf(sprite.data, from), effect, argument)
  }
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
  for (let row = 0; row < sprite.height; row += 1) {
    const sy = y + row
    if (sy < 0 || sy >= screen.height) continue
    // 효과 4 는 줄 머리에서 한 번 r 을 뽑는다 (0x9b1ee) — 그 줄에 그릴 칸이 없어도 뽑는다
    const shift = effect === DRAW_EFFECT.JITTER ? random(argument + 1) : 0
    composeRgbaRow(screen, sprite, row, sy, x, effect, argument, shift)
  }
}
