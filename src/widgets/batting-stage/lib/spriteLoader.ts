/**
 * 원본에서 뽑은 PNG를 캔버스에 쓰기 위해 불러오고 캐시한다.
 * 아직 안 불러온 그림은 null을 돌려주고, 도착하면 다음 프레임부터 그려진다 —
 * 로딩 때문에 게임 루프가 멈추면 안 된다.
 */
import { paletteUrl, recoloredSpriteUrl } from '@/shared/lib/sprite/paletteSwap'
import type { SpritePalettes } from '@/shared/lib/sprite/paletteSwap'

const cache = new Map<string, HTMLImageElement | null>()

export function sprite(url: string): HTMLImageElement | null {
  const cached = cache.get(url)
  if (cached !== undefined) return cached

  cache.set(url, null)
  const image = new Image()
  image.onload = () => cache.set(url, image)
  image.onerror = () => cache.set(url, null)
  image.src = url
  return null
}

/** 판정 글자 애니메이션 폴더 (game_judge.pzx, 0x393b4) */
export const JUDGE_FRAMES = './sprites/game_judge/frames'

/** 경기 연출 그림 (game_effect.pzx, 게임+0x102c) — 홈런 글자는 이미지 54~60 (R2 3-2) */
export const GAME_EFFECT_IMAGE = (index: number) =>
  `./sprites/game_effect/${String(index).padStart(3, '0')}.png`
export const GAME_EFFECT_FRAMES = './sprites/game_effect/frames'

export const FIELD_BACKGROUND = './sprites/attack/000.png'

/**
 * 합성 프레임의 원점.
 *
 * PZX 프레임은 파트들의 바운딩 박스로 잘라 저장하므로 프레임마다 크기가 다르다.
 * 그림자·몸통·헬멧·배트처럼 여러 파일로 나뉜 레이어를 겹치려면 잘라낸 원점이
 * 필요해서 decode_pzx.py 가 origins.json 에 같이 남긴다.
 */
export interface FrameOrigin {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const originsCache = new Map<string, Readonly<Record<string, FrameOrigin>> | null>()

function frameOrigins(folder: string): Readonly<Record<string, FrameOrigin>> | null {
  const cached = originsCache.get(folder)
  if (cached !== undefined) return cached

  originsCache.set(folder, null)
  void fetch(`${folder}/origins.json`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => originsCache.set(folder, data))
    .catch(() => originsCache.set(folder, null))
  return null
}

export interface PlacedFrame {
  readonly image: HTMLImageElement
  readonly offsetX: number
  readonly offsetY: number
}

export interface StageAnimationEntry {
  readonly frame: number
  readonly delay: number
}

const animationsCache = new Map<string, readonly (readonly StageAnimationEntry[])[] | null>()

/** 폴더의 animations.json. 아직 안 불러왔으면 null */
export function frameAnimations(folder: string): readonly (readonly StageAnimationEntry[])[] | null {
  const cached = animationsCache.get(folder)
  if (cached !== undefined) return cached
  animationsCache.set(folder, null)
  void fetch(`${folder}/animations.json`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => animationsCache.set(folder, data))
    .catch(() => animationsCache.set(folder, null))
  return null
}

// ── 대체 팔레트(.mpl) 갈아 끼우기 ───────────────────────────────────────────
// <img> 쪽은 `shared/lib/sprite/paletteSwap` 의 훅이 맡지만 캔버스에는 훅을 쓸 수 없어
// 원점·애니 표와 같은 방식(비동기로 받아 두고 도착하면 다음 프레임부터)으로 캐시한다.

const palettesCache = new Map<string, SpritePalettes | null>()

/** 폴더의 palette.json. 아직 안 불러왔으면 null */
function spritePalettes(folder: string): SpritePalettes | null {
  const cached = palettesCache.get(folder)
  if (cached !== undefined) return cached

  palettesCache.set(folder, null)
  void fetch(paletteUrl(`${folder}/000.png`))
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => palettesCache.set(folder, data))
    .catch(() => palettesCache.set(folder, null))
  return null
}

/**
 * 칠해 둔 그림. **키는 그림 URL + 팔레트 번호**다 — URL 만으로 키를 잡으면
 * 팔레트를 바꿔도 먼저 칠한 그림이 계속 나온다 (`tools/apply_mpl.py` 머리 주석의 함정).
 * 값이 null 이면 아직 칠하는 중이라 구운 그림을 그대로 내보낸다 (화면이 비지 않게).
 */
const painted = new Map<string, HTMLImageElement | null>()

function recoloredSprite(folder: string, url: string, paletteIndex: number): HTMLImageElement | null {
  const key = `${url}#${paletteIndex}`
  const done = painted.get(key)
  if (done !== undefined) return done ?? sprite(url)

  const palettes = spritePalettes(folder)
  // palette.json 이 아직 안 왔으면 캐시에 못 박지 않고 구운 그림을 쓴다 — 다음 프레임에 다시 본다.
  if (palettes === null) return sprite(url)
  if (paletteIndex === palettes.baked) return sprite(url)

  painted.set(key, null)
  void recoloredSpriteUrl(url, palettes, paletteIndex)
    .then((dataUrl) => (dataUrl === url ? null : loadSprite(dataUrl)))
    .then((image) => {
      if (image !== null) painted.set(key, image)
    })
    .catch(() => {})
  return sprite(url)
}

function loadSprite(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

/**
 * 프레임 한 장을 원점과 함께 돌려준다. 아직 안 불러왔으면 null.
 * `paletteIndex` 를 주면 그 폴더의 대체 팔레트 벌로 칠한 그림을 쓴다 (C-1 — 몸통 피부×15+팀 · 헬멧 팀).
 * 칠하기 전에는 구운 그림이 나가므로 첫 몇 프레임은 구워진 벌(palette.json 의 baked)이 보인다.
 */
export function placedFrame(folder: string, index: number, paletteIndex: number | null = null): PlacedFrame | null {
  const origins = frameOrigins(folder)
  if (origins === null) return null

  const key = String(index).padStart(3, '0')
  const origin = origins[key]
  if (origin === undefined) return null

  const url = `${folder}/${key}.png`
  const image = paletteIndex === null ? sprite(url) : recoloredSprite(folder, url, paletteIndex)
  if (image === null) return null
  return { image, offsetX: origin.x, offsetY: origin.y }
}

/** 마선수가 아닐 때 마운드에 서는 평범한 투수 */
export const PITCHER_FRAMES = './sprites/pitcher/frames'

/** 타석 배경 폴더 (위치 분석 6차) */
export const CLOUD_FRAMES = './sprites/attack_sky_cloud/frames'
export const FENCE_FRAMES = './sprites/fence/frames'
export const CROWD_FRAMES = './sprites/ppl/frames'
export const SCOREBOARD_FRAMES = './sprites/board_ani/frames'
export const TEAM_ICON = (index: number) => `./sprites/team_s_icon/${String(index).padStart(3, '0')}.png`
