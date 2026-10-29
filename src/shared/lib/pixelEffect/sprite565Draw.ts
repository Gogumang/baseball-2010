import { DRAW_EFFECT, effectPixel565, isEffectDrawn } from '@/shared/lib/pixelEffect/pixelEffect'
import { blackStepCoverPixel565, colorStepCoverPixel565 } from '@/shared/lib/stepCover/stepCover'
import { rgbTo565 } from '@/shared/lib/screen565/screen565'
import type { ComposeCoverOp, Sprite565 } from '@/shared/lib/pixelEffect/composeTypes'

/** RGBA(웹 PNG — 565 를 비트 복제로 늘린 값) → 565 그림. 알파 0 만 투명으로 본다 */
export function sprite565Of(rgba: ArrayLike<number>, width: number, height: number): Sprite565 {
  const pixels = new Uint16Array(width * height)
  const opaque = new Uint8Array(width * height)
  for (let index = 0; index < width * height; index += 1) {
    const at = index * 4
    if (rgba[at + 3] === 0) continue
    pixels[index] = rgbTo565(rgba[at], rgba[at + 1], rgba[at + 2])
    opaque[index] = 1
  }
  return { width, height, pixels, opaque }
}

/** 그림 칸 하나를 화면 칸에 효과로 — 투명 칸은 건너뛰고, 칠했으면 `touched` 에 적는다 */
function blendSpritePixel565(
  screen: Uint16Array,
  at: number,
  sprite: Sprite565,
  from: number,
  effect: number,
  argument: number,
  touched: Uint8Array | null,
): void {
  if (sprite.opaque[from] === 0) return
  screen[at] = effectPixel565(effect, argument, sprite.pixels[from], screen[at])
  if (touched !== null) touched[at] = 1
}

/** 정수 자리 (left, top) 에 그림을 칠한다 — 화면 밖 줄은 건너뛰고 열은 화면 안 [0, 폭) 에 드는 것만 돈다 */
function paintSprite565(
  screen: Uint16Array,
  width: number,
  height: number,
  sprite: Sprite565,
  left: number,
  top: number,
  effect: number,
  argument: number,
  flipX: boolean,
  touched: Uint8Array | null,
): void {
  const firstColumn = Math.max(0, -left)
  const lastColumn = Math.min(sprite.width, width - left)
  for (let row = 0; row < sprite.height; row += 1) {
    const sy = top + row
    if (sy < 0 || sy >= height) continue
    for (let column = firstColumn; column < lastColumn; column += 1) {
      const from = row * sprite.width + (flipX ? sprite.width - 1 - column : column)
      blendSpritePixel565(screen, sy * width + left + column, sprite, from, effect, argument, touched)
    }
  }
}

/** 화면 버퍼에 그림 한 장 — 좌표는 정수로 내리고 화면 밖은 자른다 */
export function drawSprite565(
  screen: Uint16Array,
  width: number,
  height: number,
  sprite: Sprite565,
  x: number,
  y: number,
  effect: number = DRAW_EFFECT.COPY,
  argument = 0,
  flipX = false,
  touched: Uint8Array | null = null,
): void {
  if (effect === DRAW_EFFECT.JITTER || !isEffectDrawn(effect, argument)) return
  paintSprite565(screen, width, height, sprite, Math.floor(x), Math.floor(y), effect, argument, flipX, touched)
}

/** 화면 버퍼 사각형 단계 덮기 (`ComposeCoverOp`) */
export function coverRect565(screen: Uint16Array, width: number, height: number, op: Omit<ComposeCoverOp, 'kind'>): void {
  const left = Math.max(0, Math.floor(op.x))
  const top = Math.max(0, Math.floor(op.y))
  const right = Math.min(width, Math.floor(op.x) + op.width)
  const bottom = Math.min(height, Math.floor(op.y) + op.height)
  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      const at = row * width + column
      screen[at] = op.color === null ? blackStepCoverPixel565(op.step, screen[at]) : colorStepCoverPixel565(op.step, op.color, screen[at])
    }
  }
}
