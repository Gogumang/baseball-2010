/**
 * **파트 효과 0x67 = 픽셀 효과 2 더하기** — 그런 파트가 든 프레임의 겹 목록(`frames/layers.json`).
 *
 * 원본 프레임 그리기 0xc9f98 (직접 뜸):
 * ```
 * c9fae  부른 쪽 효과(r3 → sp+0x2c) == 0x10 → 확대 갈래 (파트 효과 안 봄)
 * ca074  == 0x11 → 뒤집기 갈래 ca07c: 파트마다 효과 0x11 로 그린다 (+0x10 안 읽음)
 * ca198  그 밖: 부른 쪽 효과가 0 이고 파트+0x10 이 0x65~0x74 면 픽셀 효과 = 표 0xda988[효과 − 0x65]
 *        ([1, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 19, 19, 19, 19] → 0x67 = 2), 인자 = 파트+0x14 (ca1a8~ca1b0)
 *        부른 쪽 효과가 0 이 아니면(ca19c bne → ca1e8) 그 효과로 그린다
 * ```
 * 파트는 파일 차례대로 화면에 바로 그려진다. 효과 2(16비트 0x9a2f1 · 팔레트판 0x973c5)는 화면 + (그림 · b) >> 8 이라
 * 아래 화면이 있어야 색이 나온다 — PNG 로 구울 수 없다. 그래서 `tools/decode_pzx.py` 의 `write_frame_layers` 가
 * 그런 프레임을 겹(보통 파트 묶음 · 0x67 파트 날 그림)으로 나눠 따로 낸다. 구운 `frames/NNN.png` 는 알파 b/255 근사다.
 */
import { DRAW_EFFECT, drawImagesWithEffect, type ImageEffectDraw } from '@/shared/lib/pixelEffect/pixelEffect'

/** `layers.json` 의 한 칸 — x · y 는 origins.json 과 같은 프레임 좌표 */
export interface FrameLayerEntry {
  /** `frames/layers/` 안의 그림 이름 */
  readonly png: string
  readonly x: number
  readonly y: number
  /** 0 = 보통 파트 묶음(구운 그대로) · 2 = 0x67 파트(더하기) */
  readonly effect: number
  /** 효과 2 의 b (파트+0x14) */
  readonly argument?: number
}

/** 프레임 번호(`000`) → 겹 목록. 0x67 파트가 있는 프레임만 들어 있다 */
export type FrameLayerListing = Readonly<Record<string, readonly FrameLayerEntry[]>>

/**
 * `layers.json` 을 둔 폴더(`public/sprites/<이름>/frames`) — 0x67 파트를 쓰는 PZX 13개 가운데 캔버스가 그리는 것만 실었다
 * (`frameLayers.test` 가 파일과 맞춰 본다). 다른 폴더는 목록을 청하지 않는다(없는 파일을 404 로 청하지 않게).
 * main_title 은 타이틀 캔버스(`pages/title`)와 메뉴 바탕 0x58371(`SkinBackdrops`)이, game_judge 는 수비 화면 DOM 판정 글자도
 * (`shared/ui/LayeredFrameSprite` — plus-lighter) 쓴다.
 * leony_effect 는 원본에서 화면에 안 나오지만(B-82) 고친 길(`bugfixes.json` B-82)이 그린다 — `acePitcherEffect`.
 * 0x67 을 쓰지만 안 실은 것: sky_effect_light1(그리는 자리 없음) ·
 * touch(원본 binary.mod 에 파일 이름조차 없다 — 안 쓰는 그림).
 * trainning 21~23(애니 3 "200G")은 더비 0x41098 이 효과 0 으로 그린다 — 웹은 DOM 더비 HUD(`DerbyHud` · `LayeredFrameSprite`).
 */
export const FRAME_LAYER_FOLDERS: ReadonlySet<string> = new Set([
  'effect_power',
  'game_effect',
  'game_judge',
  'game_ui',
  'leony_effect',
  'main_title',
  'medica_effect',
  'pitcher_dragona',
  'sky_effect_light',
  'slt_pitch',
  'trainning',
])

/** `./sprites/game_effect/frames` → 겹 목록이 있는가 */
export function hasFrameLayers(framesFolder: string): boolean {
  const match = /sprites\/([^/]+)\/frames$/.exec(framesFolder)
  return match !== null && FRAME_LAYER_FOLDERS.has(match[1])
}

export const frameLayersUrl = (framesFolder: string) => `${framesFolder}/layers.json`
export const frameLayerUrl = (framesFolder: string, entry: FrameLayerEntry) => `${framesFolder}/layers/${entry.png}`

/** 받은 `layers.json`(모양이 틀리면 빈 목록) 에서 고른 프레임들의 겹 그림 주소 — 같은 그림은 한 번 (미리 받기 `spritePreload`) */
export function frameLayerUrlsOf(framesFolder: string, listing: unknown, frames: readonly number[]): string[] {
  if (listing === null || typeof listing !== 'object') return []
  const urls = new Set<string>()
  for (const frame of frames) {
    const entries: unknown = (listing as Record<string, unknown>)[String(frame).padStart(3, '0')]
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      const png = typeof entry === 'object' && entry !== null ? (entry as { png?: unknown }).png : undefined
      if (typeof png === 'string') urls.add(`${framesFolder}/layers/${png}`)
    }
  }
  return [...urls]
}

/** 받은 겹 하나 */
export interface PlacedFrameLayer {
  readonly image: HTMLImageElement | HTMLCanvasElement
  readonly offsetX: number
  readonly offsetY: number
  readonly effect: number
  readonly argument: number
}

/**
 * 프레임 하나의 겹 — `listing` 은 받은 `layers.json`(아직이면 null), `imageOf` 는 겹 그림 주소 → 받은 그림(아직이면 null).
 * 목록 · 그림 하나라도 아직이거나 그 프레임에 0x67 파트가 없으면 null — 부르는 쪽은 구운 프레임을 그린다.
 */
export function placedFrameLayersOf(
  folder: string,
  index: number,
  listing: FrameLayerListing | null,
  imageOf: (url: string) => HTMLImageElement | HTMLCanvasElement | null,
): readonly PlacedFrameLayer[] | null {
  const entries = listing?.[String(index).padStart(3, '0')]
  if (entries === undefined) return null
  const layers: PlacedFrameLayer[] = []
  for (const entry of entries) {
    const image = imageOf(frameLayerUrl(folder, entry))
    if (image === null) return null
    layers.push({ image, offsetX: entry.x, offsetY: entry.y, effect: entry.effect, argument: entry.argument ?? 0 })
  }
  return layers
}

/**
 * 겹을 차례대로 그린다 — `partEffects` 가 참(부른 쪽 효과 0)이면 0x67 겹을 화면에 더하기로 얹고,
 * 거짓(부른 쪽 효과 0x11 뒤집기 · 0x10 확대)이면 원본처럼 파트 효과 없이 모두 그대로 복사한다.
 * 더하기는 그 자리 화면 칸을 읽는다(`drawImagesWithEffect`) — 변환 없는 캔버스에서만 원본 식이다.
 */
export function drawFrameLayers(
  context: CanvasRenderingContext2D,
  layers: readonly PlacedFrameLayer[],
  x: number,
  y: number,
  partEffects = true,
): void {
  // 이어진 더하기 겹은 모아 그린다 — 하나씩 그린 것과 같은 픽셀에 화면 읽기 · 쓰기만 모은다(`drawImagesWithEffect`)
  const pending: ImageEffectDraw[] = []
  for (const layer of layers) {
    const left = x + layer.offsetX
    const top = y + layer.offsetY
    if (partEffects && layer.effect === DRAW_EFFECT.ADDITIVE) {
      pending.push({ image: layer.image, x: left, y: top, effect: DRAW_EFFECT.ADDITIVE, argument: layer.argument })
      continue
    }
    drawImagesWithEffect(context, pending.splice(0))
    context.drawImage(layer.image, left, top)
  }
  drawImagesWithEffect(context, pending)
}
