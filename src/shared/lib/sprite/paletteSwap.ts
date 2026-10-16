/**
 * 팀·피부에 따라 선수 그림 색을 갈아 끼운다 (원본 `.mpl` 대체 팔레트, C-create-palette.md C-1).
 *
 * 원본은 8비트 인덱스 그림이라 팔레트만 바꿔 끼우면 같은 그림이 15팀 × 3피부로 나온다
 * (binary.mod 0x78ab0 몸통·헬멧 · 0x793b0 투수 · 0x48658 수비수 · 0x63a7e 이벤트 초상화).
 * 웹판은 PNG 를 구워 두므로 두 가지 중 하나를 골라야 했다:
 *
 *   벌마다 굽기   batter_* · pitcher 45벌 + helmet · defender 15벌 = 12,315장 50MB — **버렸다**
 *   런타임 교체   구운 PNG 한 벌 + 팔레트 표 + 팔레트 번호 지도 = 3MB — **이쪽**
 *
 * `tools/apply_mpl.py` 가 폴더마다 두 가지를 내 둔다:
 *   `<폴더>/palette.json`            벌 전체와 구워진 벌 번호
 *   `<폴더>/[frames/]index/NNN.png`  픽셀마다 팔레트 번호 (빨강 = 번호, 알파 0 = 손대지 말 것)
 *
 * 번호 지도가 꼭 있어야 하는 이유: 구운 PNG 는 색이 납작해져 번호를 잃는데, 기본 팔레트에
 * **같은 색이 두 번호에 들어 있고 벌마다 갈라지는** 자리가 있다 (pitcher #005142 = 번호 10·25,
 * 45벌 중 42벌에서 서로 다른 색). 색만 보고 바꾸면 그 자리가 틀린다.
 */
import { useEffect, useState } from 'react'
import { useSpriteJson } from '@/shared/lib/sprite/useSpriteJson'

/** `tools/apply_mpl.py` 가 낸 `<폴더>/palette.json`. */
export interface SpritePalettes {
  /** 원본 파일 이름 (예: `bat/batter_balancer.mpl`) */
  readonly mpl: string
  /** 벌 고르는 법을 적어 둔 말 (사람이 읽는 용도) */
  readonly select: string
  /** 구워 둔 PNG 가 이미 쓰는 벌 번호. 없으면 null */
  readonly baked: number | null
  /** PZX 안 기본 팔레트 (`#rrggbb`) */
  readonly colors: readonly string[]
  /** 벌 × 색 (`#rrggbb`) */
  readonly palettes: readonly (readonly string[])[]
}

/** 팀 수 15 — 팔레트 45벌 = 피부 3 × 팀 15 (C-1). */
export const TEAM_COUNT = 15

/**
 * 몸통(batter_balancer·batter_sluger·pitcher) 팔레트 번호 = **피부 × 15 + 팀** (0x78be8).
 * 헬멧·수비수는 피부가 없어 팀 번호만 쓴다.
 */
export function outfitPaletteIndex(skinIndex: number, teamIndex: number): number {
  return skinIndex * TEAM_COUNT + teamIndex
}

/**
 * 이벤트 초상화(event_char_0) 팔레트 번호 (0x63a7e): 피부 1 → 0 · 2 → 1 · 0 → 쓰지 않는다
 * (PZX 안 기본 팔레트가 이미 황인이다). 2번 벌은 주인공이 아닌 인물 8·9 전용이다 (0x63a50).
 */
export const PORTRAIT_OTHER_PEOPLE_PALETTE = 2

export function portraitPaletteIndex(skinIndex: number): number | null {
  return skinIndex === 1 ? 0 : skinIndex === 2 ? 1 : null
}

/** `#rrggbb` → [r, g, b]. 모양이 틀리면 검정으로 둔다. */
export function parseHexColor(text: string): readonly [number, number, number] {
  if (text.length !== 7 || text[0] !== '#') return [0, 0, 0]
  const value = Number.parseInt(text.slice(1), 16)
  if (Number.isNaN(value)) return [0, 0, 0]
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/**
 * 구운 그림(color)을 번호 지도(index)와 팔레트로 다시 칠한다. 캔버스 없이 도는 순수 함수다.
 *
 * 번호 지도의 알파가 0 인 자리는 채우기 효과 자리나 반투명 파트가 **아래 파트와** 섞인 자리라 번호가
 * 뜻을 잃는다 — 구운 색을 그대로 둔다 (**근사다**). 반투명 파트가 아래 없이 놓인 자리(하늘 조명 ·
 * defender 그림자 · event_char_0 볼터치)는 번호가 있다: 원본도 반투명 그리기 0x97769 · 0x973c5 에서
 * 그 그림의 (갈아 끼운) 팔레트[번호] 로 색을 얻는다 (r134, 그리기 0xc9f98 · 표 0xda988).
 * 알파는 구운 그림 것을 그대로 두고 RGB 만 바꾼다.
 */
export function recolorPixels(
  color: Uint8ClampedArray,
  index: Uint8ClampedArray,
  palette: readonly string[],
): Uint8ClampedArray {
  const table = paletteTableOf(palette)
  const output = new Uint8ClampedArray(color)
  for (let at = 0; at < output.length; at += 4) {
    if (index[at + 3] === 0) continue
    const replacement = table[index[at]]
    if (replacement === undefined) continue
    output[at] = replacement[0]
    output[at + 1] = replacement[1]
    output[at + 2] = replacement[2]
  }
  return output
}

const paletteTables = new WeakMap<readonly string[], readonly (readonly [number, number, number])[]>()

/** 벌의 `#rrggbb` 를 [r, g, b] 표로 — 같은 벌(배열)은 한 번만 푼다 */
function paletteTableOf(palette: readonly string[]): readonly (readonly [number, number, number])[] {
  const cached = paletteTables.get(palette)
  if (cached !== undefined) return cached
  const table = palette.map(parseHexColor)
  paletteTables.set(palette, table)
  return table
}

/** `./sprites/pitcher/frames/003.png` → `./sprites/pitcher/frames/index/003.png` */
export function indexMapUrl(spriteUrl: string): string {
  const cut = spriteUrl.lastIndexOf('/')
  return cut < 0 ? spriteUrl : `${spriteUrl.slice(0, cut)}/index${spriteUrl.slice(cut)}`
}

/** `./sprites/pitcher/frames/003.png` → `./sprites/pitcher/palette.json` */
export function paletteUrl(spriteUrl: string): string {
  const parts = spriteUrl.split('/')
  const cut = parts.lastIndexOf('frames')
  return `${(cut < 0 ? parts.slice(0, -1) : parts.slice(0, cut)).join('/')}/palette.json`
}

// ── 브라우저에서 실제로 칠하기 ──────────────────────────────────────────────

const recolored = new Map<string, Promise<string>>()
/** 다 칠한 그림 — 같은 (그림, 벌) 이 다시 오면 기다리지 않고 바로 쓴다 (프레임마다 구운 색이 한 번 비치던 깜박임을 막는다) */
const painted = new Map<string, string>()

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
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

/**
 * 팔레트를 갈아 끼운 그림의 URL. 같은 (그림, 벌) 은 한 번만 칠한다.
 * `paletteIndex` 가 null 이거나 벌이 없으면 구운 그림을 그대로 쓴다.
 */
export function recoloredSpriteUrl(
  spriteUrl: string,
  palettes: SpritePalettes | null,
  paletteIndex: number | null,
): Promise<string> {
  if (palettes === null || paletteIndex === null) return Promise.resolve(spriteUrl)
  if (paletteIndex === palettes.baked) return Promise.resolve(spriteUrl)
  const palette = palettes.palettes[paletteIndex]
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
export function readyRecoloredSpriteUrl(
  spriteUrl: string,
  palettes: SpritePalettes | null,
  paletteIndex: number | null,
): string | null {
  if (palettes === null || paletteIndex === null) return spriteUrl
  if (paletteIndex === palettes.baked) return spriteUrl
  if (palettes.palettes[paletteIndex] === undefined) return spriteUrl
  return painted.get(`${spriteUrl}#${paletteIndex}`) ?? null
}

/** 폴더의 `palette.json`. 아직 오지 않았거나 실패하면 null. */
export function useSpritePalettes(folder: string): SpritePalettes | null {
  return useSpriteJson<SpritePalettes>(`${folder}/palette.json`)
}

/** 팔레트를 갈아 끼운 그림. 칠하기 전에는 구운 그림을 그대로 내보내 화면이 비지 않는다. */
export function useRecoloredSprite(spriteUrl: string, paletteIndex: number | null): string {
  // 벌을 안 고르면(null) palette.json 을 청하지 않는다 — 팔레트가 없는 폴더(batter_batter 따위)가 404 를 내던 일 (r124 측정)
  const palettes = useSpriteJson<SpritePalettes>(paletteIndex === null ? null : paletteUrl(spriteUrl))
  // 이미 칠한 그림이면 그리는 그 자리에서 곧장 쓴다 — 프레임이 바뀔 때마다 구운 색(다른 팀 색)이
  // 한 번 비치고 구운 그림 요청이 끊기던 일을 막는다. 아직 칠하는 중이면 지금까지처럼 구운 그림이다
  const ready = readyRecoloredSpriteUrl(spriteUrl, palettes, paletteIndex)
  const key = `${spriteUrl}#${paletteIndex ?? ''}`
  const [painted, setPainted] = useState<{ readonly key: string; readonly url: string } | null>(null)

  useEffect(() => {
    if (readyRecoloredSpriteUrl(spriteUrl, palettes, paletteIndex) !== null) return
    let isActive = true
    recoloredSpriteUrl(spriteUrl, palettes, paletteIndex).then((url) => {
      if (isActive) setPainted({ key, url })
    })
    return () => {
      isActive = false
    }
  }, [spriteUrl, palettes, paletteIndex, key])

  return ready ?? (painted !== null && painted.key === key ? painted.url : spriteUrl)
}
