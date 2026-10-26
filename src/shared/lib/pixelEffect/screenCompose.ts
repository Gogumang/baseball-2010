/**
 * **화면 버퍼 합성 (RGB565)** — 원본처럼 16비트 화면 버퍼 하나에 그리기를 차례로 덮어 쓴다.
 *
 * DOM 겹치기는 아래 화면 픽셀을 못 읽어 반투명(효과 1 0x9a449) · 단계 덮기(0x9aac4 · 0x9a52c)를 CSS 불투명도로 근사한다.
 * 아래 화면을 모두 아는 자리(지도 · 판처럼 그 장면이 다 그리는 밑그림)는 이 버퍼에 원본 식 그대로 그려 캔버스 한 장으로 놓는다
 * (`shared/ui/ComposedScreen`). 식은 효과 번호별 `effectPixel565`(그림 0x985ed 표) · 단계 덮기 `stepCover` 의 픽셀 식이다.
 */
import { DRAW_EFFECT, effectPixel565, isEffectDrawn } from '@/shared/lib/pixelEffect/pixelEffect'
import { blackStepCoverPixel565, colorStepCoverPixel565 } from '@/shared/lib/stepCover/stepCover'
import { rgbOf565, rgbTo565 } from '@/shared/lib/screen565/screen565'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'

/** 565 로 읽어 둔 그림 — `opaque[i]` 가 0 이면 투명 칸(원본 PZX 의 투명색 · 웹 PNG 알파 0) */
export interface Sprite565 {
  readonly width: number
  readonly height: number
  readonly pixels: Uint16Array
  readonly opaque: Uint8Array
}

/** 그림 한 장을 (x, y) 에 효과로 — 0x985ed 표의 효과 번호(효과 4 흔들기는 다루지 않는다) */
export interface ComposeImageOp {
  readonly kind: 'image'
  readonly src: string
  readonly x: number
  readonly y: number
  readonly effect?: number
  readonly argument?: number
}

/**
 * 사각형 단계 덮기 — `color` 가 null 이면 [0x15605d4] 검정 0x9b234(몸통 0x9aac4), 아니면 [0x15605d0] 색 0x9b3f4(몸통 0x9a52c, 565 색).
 * 감싸는 함수처럼 화면 안으로 자른다.
 */
export interface ComposeCoverOp {
  readonly kind: 'cover'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly step: number
  readonly color: number | null
}

export type ComposeOp = ComposeImageOp | ComposeCoverOp

/** PZX 합성 프레임 한 장을 원점에 맞춘 그리기 (`FrameSprite` 와 같은 자리) — 원점을 아직 못 읽었으면 빈 목록 */
export function frameComposeOps(
  folder: string,
  frame: number,
  origins: FrameOrigins | null,
  x: number,
  y: number,
  effect: number = DRAW_EFFECT.COPY,
  argument = 0,
): readonly ComposeImageOp[] {
  const key = String(frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return []
  return [{ kind: 'image', src: `${folder}/${key}.png`, x: x + origin.x, y: y + origin.y, effect, argument }]
}

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
): void {
  if (effect === DRAW_EFFECT.JITTER || !isEffectDrawn(effect, argument)) return
  const left = Math.floor(x)
  const top = Math.floor(y)
  for (let row = 0; row < sprite.height; row += 1) {
    const sy = top + row
    if (sy < 0 || sy >= height) continue
    for (let column = 0; column < sprite.width; column += 1) {
      const sx = left + column
      if (sx < 0 || sx >= width) continue
      const from = row * sprite.width + column
      if (sprite.opaque[from] === 0) continue
      const at = sy * width + sx
      screen[at] = effectPixel565(effect, argument, sprite.pixels[from], screen[at])
    }
  }
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
      screen[at] = op.color === null
        ? blackStepCoverPixel565(op.step, screen[at])
        : colorStepCoverPixel565(op.step, op.color, screen[at])
    }
  }
}

/**
 * 바탕 색(565)으로 채운 화면에 그리기를 차례로 — 아직 못 읽은 그림(`spriteOf` 가 null)은 건너뛴다.
 * 돌려준 `missing` 이 참이면 빠진 그림이 있다(다 받은 뒤 다시 그린다).
 */
export function composeScreen565(
  width: number,
  height: number,
  backdrop: number,
  ops: readonly ComposeOp[],
  spriteOf: (src: string) => Sprite565 | null,
): { readonly pixels: Uint16Array; readonly missing: boolean } {
  const pixels = new Uint16Array(width * height).fill(backdrop & 0xffff)
  let missing = false
  for (const op of ops) {
    if (op.kind === 'cover') {
      coverRect565(pixels, width, height, op)
      continue
    }
    const sprite = spriteOf(op.src)
    if (sprite === null) {
      missing = true
      continue
    }
    drawSprite565(pixels, width, height, sprite, op.x, op.y, op.effect, op.argument)
  }
  return { pixels, missing }
}

/** 565 화면 → 불투명 RGBA (비트 복제로 편다 — 웹 그림과 같은 꼴) */
export function rgbaOfScreen565(pixels: Uint16Array, out: Uint8ClampedArray = new Uint8ClampedArray(pixels.length * 4)): Uint8ClampedArray {
  for (let index = 0; index < pixels.length; index += 1) {
    const [r, g, b] = rgbOf565(pixels[index])
    const at = index * 4
    out[at] = r
    out[at + 1] = g
    out[at + 2] = b
    out[at + 3] = 255
  }
  return out
}
