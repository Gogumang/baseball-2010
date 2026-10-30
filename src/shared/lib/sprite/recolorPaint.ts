import { indexMapUrl, recolorPixels, type SpritePalettes } from '@/shared/lib/sprite/palettePixels'

/** 브라우저에서 실제로 칠하기 — 그림 · 번호 지도를 받아 캔버스로 다시 칠한 주소. 같은 (그림, 벌) 은 한 번만 칠한다 */
const recolored = new Map<string, Promise<string>>()
/** 다 칠한 그림 — 같은 (그림, 벌) 이 다시 오면 기다리지 않고 바로 쓴다 (프레임마다 구운 색이 한 번 비치던 깜박임을 막는다) */
const painted = new Map<string, string>()

/**
 * 그림을 받아 **풀기(decode)까지** 마친다 — 웹킷은 `onload` 직후 캔버스에 그려 픽셀을 읽으면 아직 안 풀린 그림이 빈 칸(알파 0)으로
 * 읽힐 때가 있다. 그러면 칠한 그림이 통째로 비거나(그림) 구운 색 그대로 남고(번호 지도) 그 결과가 캐시에 박힌다 — 경기 중간
 * 스냅샷으로 많은 그림을 한꺼번에 받던 웹킷에서 타자 몸통 · 팔이 빠져 보였다(r355). 픽셀 값은 같다
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (typeof image.decode !== 'function') return resolve(image)
      image.decode().then(
        () => resolve(image),
        () => resolve(image),
      )
    }
    image.onerror = () => reject(new Error(`그림을 불러오지 못했습니다: ${url}`))
    image.src = url
  })
}

interface SpritePixels {
  readonly width: number
  readonly height: number
  /** 구운 색 RGBA (읽기 전용) */
  readonly colors: Uint8ClampedArray
  /** 번호 지도 RGBA (읽기 전용) */
  readonly indices: Uint8ClampedArray
}

/** 그림 · 번호 지도 픽셀 — 같은 그림을 다른 벌로 또 칠할 때(두 팀 타자 따위) 다시 받고 읽지 않게 최근 것만 둔다 */
const recentPixels = new Map<string, Promise<SpritePixels | null>>()
const RECENT_PIXELS_LIMIT = 48

/** 픽셀을 읽는 캔버스 — 읽기가 잦다고 알려 GPU→CPU 동기 읽기를 피한다(값은 같다) */
const READ_CONTEXT_OPTIONS: CanvasRenderingContext2DSettings = { willReadFrequently: true }

/**
 * 받지 못한 번호 지도 — 다시 청하지 않는다. 벌·프레임마다 새로 칠할 때 같은 지도를 거듭 404 로 청하던
 * 일(r111 측정: 하늘·구름 지도가 디스크에 없어 경기 중 계속 다시 청했다)을 막는다. 지도가 없으면 구운 그림을 쓴다.
 */
const failedIndexMaps = new Set<string>()

async function readSpritePixels(spriteUrl: string): Promise<SpritePixels | null> {
  const indexUrl = indexMapUrl(spriteUrl)
  if (failedIndexMaps.has(indexUrl)) return null
  const indexRequest = loadImage(indexUrl).catch((error: unknown) => {
    failedIndexMaps.add(indexUrl)
    throw error
  })
  const [sprite, indexMap] = await Promise.all([loadImage(spriteUrl), indexRequest])
  const canvas = document.createElement('canvas')
  canvas.width = sprite.width
  canvas.height = sprite.height
  const context = canvas.getContext('2d', READ_CONTEXT_OPTIONS)
  if (context === null) return null

  context.drawImage(sprite, 0, 0)
  const colors = context.getImageData(0, 0, canvas.width, canvas.height)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(indexMap, 0, 0)
  const indices = context.getImageData(0, 0, canvas.width, canvas.height)
  return { width: canvas.width, height: canvas.height, colors: colors.data, indices: indices.data }
}

function spritePixelsOf(spriteUrl: string): Promise<SpritePixels | null> {
  const cached = recentPixels.get(spriteUrl)
  if (cached !== undefined) {
    // 최근에 쓴 것을 맨 뒤로
    recentPixels.delete(spriteUrl)
    recentPixels.set(spriteUrl, cached)
    return cached
  }
  const request = readSpritePixels(spriteUrl)
  // 실패는 남기지 않는다
  request.catch(() => recentPixels.delete(spriteUrl))
  recentPixels.set(spriteUrl, request)
  if (recentPixels.size > RECENT_PIXELS_LIMIT) recentPixels.delete(recentPixels.keys().next().value as string)
  return request
}

async function paint(spriteUrl: string, palette: readonly string[]): Promise<string> {
  const pixels = await spritePixelsOf(spriteUrl)
  if (pixels === null) return spriteUrl
  const canvas = document.createElement('canvas')
  canvas.width = pixels.width
  canvas.height = pixels.height
  // toDataURL 도 픽셀을 읽는다
  const context = canvas.getContext('2d', READ_CONTEXT_OPTIONS)
  if (context === null) return spriteUrl

  const colors = context.createImageData(pixels.width, pixels.height)
  colors.data.set(recolorPixels(pixels.colors, pixels.indices, palette))
  context.putImageData(colors, 0, 0)
  return canvas.toDataURL('image/png')
}

/** 벌 한 줄 — 받은 JSON 모양이 틀리면(벌 목록이 없으면) undefined 라 구운 그림을 쓴다 */
function paletteRowOf(palettes: SpritePalettes, paletteIndex: number): readonly string[] | undefined {
  return Array.isArray(palettes.palettes) ? palettes.palettes[paletteIndex] : undefined
}

/**
 * 팔레트를 갈아 끼운 그림의 URL. 같은 (그림, 벌) 은 한 번만 칠한다.
 * `paletteIndex` 가 null 이거나 벌이 없으면 구운 그림을 그대로 쓴다.
 */
export function recoloredSpriteUrl(spriteUrl: string, palettes: SpritePalettes | null, paletteIndex: number | null): Promise<string> {
  if (palettes === null || paletteIndex === null) return Promise.resolve(spriteUrl)
  if (paletteIndex === palettes.baked) return Promise.resolve(spriteUrl)
  const palette = paletteRowOf(palettes, paletteIndex)
  if (palette === undefined) return Promise.resolve(spriteUrl)

  const key = `${spriteUrl}#${paletteIndex}`
  const cached = recolored.get(key)
  if (cached !== undefined) return cached
  // 실패를 캐시에 남기면 일시적 오류가 영영 고착된다.
  const request = paint(spriteUrl, palette).then(
    (url) => {
      painted.set(key, url)
      return url
    },
    () => spriteUrl,
  )
  recolored.set(key, request)
  return request
}

/**
 * 기다리지 않고 바로 쓸 수 있는 그림 — 칠할 것이 없으면 구운 그림, 이미 칠했으면 그 그림, 아직 칠하는 중이면 null.
 */
export function readyRecoloredSpriteUrl(spriteUrl: string, palettes: SpritePalettes | null, paletteIndex: number | null): string | null {
  if (palettes === null || paletteIndex === null) return spriteUrl
  if (paletteIndex === palettes.baked) return spriteUrl
  if (paletteRowOf(palettes, paletteIndex) === undefined) return spriteUrl
  return painted.get(`${spriteUrl}#${paletteIndex}`) ?? null
}
