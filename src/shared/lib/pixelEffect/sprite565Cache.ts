import { spriteImage } from '@/shared/lib/sprite/spriteCache'
import { sprite565Of, type Sprite565 } from '@/shared/lib/pixelEffect/screenCompose'

/** 다 받은 그림의 565 판 — 그림마다 한 번 읽는다 */
const sprites = new Map<string, Sprite565>()

/**
 * 그림 주소 → 565 판 (`screenCompose` 의 `Sprite565`). 아직 못 받았으면 null — 받기는 `spriteImage` 가 시작한다
 * (다 받은 뒤 부르는 쪽이 `loadSpriteImage` 로 기다려 다시 그린다).
 */
export function sprite565At(src: string): Sprite565 | null {
  const cached = sprites.get(src)
  if (cached !== undefined) return cached
  const image = spriteImage(src)
  if (image === null || image.naturalWidth === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) return null
  context.drawImage(image, 0, 0)
  const sprite = sprite565Of(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
  sprites.set(src, sprite)
  return sprite
}
