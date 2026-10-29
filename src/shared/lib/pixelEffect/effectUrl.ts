import { composeOverSolidRgba, recolorRgba } from '@/shared/lib/pixelEffect/rgbaEffects'
import { rgbaOfImage } from '@/shared/lib/pixelEffect/spriteRgba'

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
  pixels.data.set(backdrop === null ? recolorRgba(pixels.data, effect, argument) : composeOverSolidRgba(pixels.data, effect, argument, backdrop))
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
  const request = paintUrl(url, effect, argument, backdrop)
    .catch(() => url)
    .then((painted) => {
      paintedUrls.set(key, painted)
      return painted
    })
  urlCache.set(key, request)
  return request
}
