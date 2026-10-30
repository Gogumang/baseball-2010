import { DRAW_EFFECT, isScreenIndependentEffect } from '@/shared/lib/pixelEffect/effectNumbers'
import { isEffectDrawn } from '@/shared/lib/pixelEffect/effectPixel565'
import { translucentOpacityOf } from '@/shared/lib/pixelEffect/translucent565'
import { brightenRgba, recolorRgba } from '@/shared/lib/pixelEffect/rgbaEffects'
import { markCanvasImmutable, rgbaOfImage, spriteRgbaOf, type DrawableImage } from '@/shared/lib/pixelEffect/spriteRgba'
import { drawRgbasWithEffect, drawRgbaWithEffect, type EffectDraw } from '@/shared/lib/pixelEffect/effectDraws'

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
function drawApproximately(context: CanvasRenderingContext2D, image: DrawableImage, x: number, y: number, effect: number, argument: number): void {
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
function paintedCanvasOf(image: DrawableImage, key: string | null, paint: (rgba: Uint8ClampedArray) => Uint8ClampedArray): DrawableImage {
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
