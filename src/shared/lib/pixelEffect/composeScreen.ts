import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/pixelEffect'
import { rgbOf565 } from '@/shared/lib/screen565/screen565'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { coverRect565, drawSprite565 } from '@/shared/lib/pixelEffect/sprite565Draw'
import type { ComposeImageOp, ComposeOp, Sprite565 } from '@/shared/lib/pixelEffect/composeTypes'

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
    drawSprite565(pixels, width, height, sprite, op.x, op.y, op.effect, op.argument, op.flipX)
  }
  return { pixels, missing }
}

/**
 * **겹 하나만 합성** — 화면 사각형 `rect`(화면 좌표) 안에서 아래 그리기(`underOps`, DOM 이 이미 그린 것을 같은 좌표로 다시)를 깔고
 * 그 위 그리기(`ops`, 원본 식 효과)를 덮는다. `touched` 는 위 그리기가 칠한 칸 — 나머지는 DOM 아래 겹이 그대로 보이게 비운다.
 * 아래 그리기는 바탕 색(`backdrop`) 위에 효과 그대로 깐다. 좌표는 모두 화면 좌표다.
 */
export function composeOverlay565(
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  underOps: readonly ComposeOp[],
  ops: readonly ComposeImageOp[],
  spriteOf: (src: string) => Sprite565 | null,
  backdrop = 0,
): { readonly pixels: Uint16Array; readonly touched: Uint8Array; readonly missing: boolean } {
  const shift = <T extends ComposeOp>(op: T): T => ({ ...op, x: op.x - rect.x, y: op.y - rect.y })
  const under = composeScreen565(rect.width, rect.height, backdrop, underOps.map(shift), spriteOf)
  const touched = new Uint8Array(rect.width * rect.height)
  let missing = under.missing
  for (const op of ops.map(shift)) {
    const sprite = spriteOf(op.src)
    if (sprite === null) {
      missing = true
      continue
    }
    drawSprite565(under.pixels, rect.width, rect.height, sprite, op.x, op.y, op.effect, op.argument, op.flipX, touched)
  }
  return { pixels: under.pixels, touched, missing }
}

/** 565 화면 → 불투명 RGBA (비트 복제로 편다 — 웹 그림과 같은 꼴) */
export function rgbaOfScreen565(
  pixels: Uint16Array,
  out: Uint8ClampedArray = new Uint8ClampedArray(pixels.length * 4),
  mask: Uint8Array | null = null,
): Uint8ClampedArray {
  for (let index = 0; index < pixels.length; index += 1) {
    const at = index * 4
    if (mask !== null && mask[index] === 0) {
      out[at + 3] = 0
      continue
    }
    const [r, g, b] = rgbOf565(pixels[index])
    out[at] = r
    out[at + 1] = g
    out[at + 2] = b
    out[at + 3] = 255
  }
  return out
}
