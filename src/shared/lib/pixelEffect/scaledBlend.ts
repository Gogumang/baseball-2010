import { blendPixel565 } from '@/shared/lib/pixelEffect/colorEffects565'
import { pixelOf, writePixel } from '@/shared/lib/pixelEffect/rgbaEffects'
import { spriteRgbaOf, type DrawableImage } from '@/shared/lib/pixelEffect/spriteRgba'

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
    drawScaledBlendApproximately(context, image, x, y, width, height, weight)
    return
  }
  const sprite = spriteRgbaOf(image)
  if (sprite === null) return
  blendScaledRegion(context, sprite, Math.floor(x), Math.floor(y), width, height, scaleTenths, weight)
}

/** 변환이 걸린 캔버스 — ⚠️ 근사(남김 — 웹 DOM 한계): globalAlpha (32 − b)/32 · 최근접 키우기 */
function drawScaledBlendApproximately(
  context: CanvasRenderingContext2D,
  image: DrawableImage,
  x: number,
  y: number,
  width: number,
  height: number,
  weight: number,
): void {
  context.save()
  context.imageSmoothingEnabled = false
  context.globalAlpha *= (32 - weight) / 32
  context.drawImage(image, x, y, width, height)
  context.restore()
}

/** 그 자리 화면을 읽어 키운 그림을 섞고 다시 놓는다 — 화면 밖은 자른다 */
function blendScaledRegion(
  context: CanvasRenderingContext2D,
  sprite: ImageData,
  originX: number,
  originY: number,
  width: number,
  height: number,
  scaleTenths: number,
  weight: number,
): void {
  const left = Math.max(0, originX)
  const top = Math.max(0, originY)
  const right = Math.min(context.canvas.width, originX + width)
  const bottom = Math.min(context.canvas.height, originY + height)
  if (right <= left || bottom <= top) return
  const region = context.getImageData(left, top, right - left, bottom - top)
  for (let row = top; row < bottom; row += 1) {
    const sourceRow = Math.trunc(((row - originY) * 10) / scaleTenths)
    for (let column = left; column < right; column += 1) {
      const sourceColumn = Math.trunc(((column - originX) * 10) / scaleTenths)
      const at = ((row - top) * region.width + (column - left)) * 4
      blendScaledPixel(region.data, at, sprite, (sourceRow * sprite.width + sourceColumn) * 4, weight)
    }
  }
  context.putImageData(region, left, top)
}

/** 0xbb8d4 섞기 한 칸 — 투명 그림 칸은 건너뛰고, 빈 화면 칸(겹치기 층)은 그림 색에 알파 (32 − b)/32 */
function blendScaledPixel(out: Uint8ClampedArray, at: number, sprite: ImageData, from: number, weight: number): void {
  if (sprite.data[from + 3] === 0) return
  const source = pixelOf(sprite.data, from)
  if (out[at + 3] === 0) {
    writePixel(out, at, source, Math.round(((32 - weight) * 255) / 32))
    return
  }
  writePixel(out, at, blendPixel565(source, pixelOf(out, at), weight), out[at + 3])
}
