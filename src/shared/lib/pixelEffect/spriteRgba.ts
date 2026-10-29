export type DrawableImage = HTMLImageElement | HTMLCanvasElement

/**
 * 화면 칸을 읽는(`drawImageWithEffect`) 캔버스의 2D 문맥 옵션 — 읽기가 잦다고 알려 CPU 버퍼에 둔다.
 * GPU 가속 캔버스는 `getImageData` 마다 GPU→CPU 동기 읽기가 걸린다. 픽셀 값은 바뀌지 않는다(저장 위치만 다르다).
 * ⚠️ 캔버스의 **첫** `getContext` 가 옵션을 정한다 — 그 캔버스를 여는 모든 자리가 이 옵션으로 열어야 한다.
 */
export const EFFECT_CONTEXT_OPTIONS: CanvasRenderingContext2DSettings = { willReadFrequently: true }

/** 효과로 그릴 캔버스의 2D 문맥 (`EFFECT_CONTEXT_OPTIONS`) */
export const effectContextOf = (canvas: HTMLCanvasElement | null | undefined): CanvasRenderingContext2D | null =>
  canvas?.getContext('2d', EFFECT_CONTEXT_OPTIONS) ?? null

export function rgbaOfImage(image: DrawableImage): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', EFFECT_CONTEXT_OPTIONS)
  if (context === null || image.width === 0 || image.height === 0) return null
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, image.width, image.height)
}

/**
 * 키(그림)마다 한 번 읽어 두는 캐시 — `signatureOf` 가 null 이면 캐시하지 않고(바뀔 수 있는 그림) 매번 읽는다.
 * 같은 그림이라도 서명(크기 · 주소)이 바뀌면 다시 읽는다. 읽기가 null(아직 못 읽음)이면 남기지 않는다.
 */
export function createReadCache<K extends object, V>(read: (key: K) => V | null, signatureOf: (key: K) => string | null): (key: K) => V | null {
  const entries = new WeakMap<K, { readonly signature: string; readonly value: V }>()
  return (key) => {
    const signature = signatureOf(key)
    if (signature === null) return read(key)
    const hit = entries.get(key)
    if (hit !== undefined && hit.signature === signature) return hit.value
    const value = read(key)
    if (value === null) entries.delete(key)
    else entries.set(key, { signature, value })
    return value
  }
}

/** 다 그린 뒤 다시 안 그리는 캔버스 — 픽셀을 캐시해도 된다(`markCanvasImmutable`) */
const immutableCanvases = new WeakSet<HTMLCanvasElement>()

/** 이 캔버스는 이제 안 바뀐다 — `drawImageWithEffect` 가 그 픽셀을 한 번만 읽는다 */
export function markCanvasImmutable(canvas: HTMLCanvasElement): void {
  immutableCanvases.add(canvas)
}

/**
 * 그림 RGBA 를 그림마다 한 번만 읽는다 — 다 받은 `<img>`(주소 · 크기로 서명) 와 안 바뀌는 캔버스만 캐시한다.
 * 받는 중인 `<img>` · 그냥 캔버스는 지금처럼 매번 읽는다. 돌려준 버퍼는 **읽기 전용**이다.
 */
export const spriteRgbaOf = createReadCache<DrawableImage, ImageData>(rgbaOfImage, (image) => {
  if (image.width === 0 || image.height === 0) return null
  if (image instanceof HTMLImageElement) {
    if (!image.complete || image.naturalWidth === 0) return null
    return `${image.width}x${image.height}@${image.naturalWidth}x${image.naturalHeight}:${image.currentSrc || image.src}`
  }
  return immutableCanvases.has(image) ? `${image.width}x${image.height}` : null
})
