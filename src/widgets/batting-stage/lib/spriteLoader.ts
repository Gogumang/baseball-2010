/**
 * 원본에서 뽑은 PNG를 캔버스에 쓰기 위해 불러오고 캐시한다.
 * 아직 안 불러온 그림은 null을 돌려주고, 도착하면 다음 프레임부터 그려진다 —
 * 로딩 때문에 게임 루프가 멈추면 안 된다. 장면 앞에서 미리 받아 두면(`spritePreload`) 첫 프레임부터 있다.
 */
import { paletteUrl, recoloredSpriteUrl } from '@/shared/lib/sprite/paletteSwap'
import type { SpritePalettes } from '@/shared/lib/sprite/paletteSwap'
import { noteAssetLoaded } from '@/shared/lib/sprite/assetLoadVersion'
import { spriteImage, spriteJsonNow } from '@/shared/lib/sprite/spriteCache'
import { drawFrameLayers, frameLayersUrl, frameLayerUrl, hasFrameLayers, placedFrameLayersOf } from '@/shared/lib/sprite/frameLayers'
import type { FrameLayerListing, PlacedFrameLayer } from '@/shared/lib/sprite/frameLayers'
import { flippedFrameUrlOf, frameCopiesUrl, hasFrameCopies } from '@/shared/lib/sprite/frameCopies'

/** 캐시는 DOM·미리 받기와 같이 쓴다 (`shared/lib/sprite/spriteCache`) */
export function sprite(url: string): HTMLImageElement | null {
  return spriteImage(url)
}

/** 판정 글자 애니메이션 폴더 (game_judge.pzx, 0x393b4) */
export const JUDGE_FRAMES = './sprites/game_judge/frames'

/** 경기 연출 그림 (game_effect.pzx, 게임+0x102c) — 홈런 글자는 이미지 54~60 (R2 3-2) */
export const GAME_EFFECT_IMAGE = (index: number) =>
  `./sprites/game_effect/${String(index).padStart(3, '0')}.png`
export const GAME_EFFECT_FRAMES = './sprites/game_effect/frames'

export const FIELD_BACKGROUND = './sprites/attack/000.png'
/** 바닥 그림 폴더 — `stadium/attack.mpl` 의 잔디 팔레트가 여기 붙는다 */
const FIELD_FOLDER = './sprites/attack'

/**
 * 바닥(그라운드) 그림. `paletteIndex` 는 `stadium/attack.mpl` 의 줄이고 **null 이면 구운 그림**
 * (= PZX 안 기본 팔레트) 그대로다. 시즌 구장 잔디가 이 줄을 고른다 (`0x786c8`, S3 6절).
 */
export function fieldBackground(paletteIndex: number | null): HTMLImageElement | null {
  return paletteIndex === null
    ? sprite(FIELD_BACKGROUND)
    : recoloredSprite(FIELD_FOLDER, FIELD_BACKGROUND, paletteIndex)
}

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

function frameOrigins(folder: string): Readonly<Record<string, FrameOrigin>> | null {
  return spriteJsonNow<Readonly<Record<string, FrameOrigin>>>(`${folder}/origins.json`)
}

export interface PlacedFrame {
  readonly image: HTMLImageElement
  readonly offsetX: number
  readonly offsetY: number
}

export interface StageAnimationEntry {
  readonly frame: number
  readonly delay: number
  /** 칸마다 그림을 비켜 놓는 값 — 애니 그리기 0x93c45 가 (x + dx, y + dy) 에 그린다. 표에 없으면 0 */
  readonly dx?: number
  readonly dy?: number
}

/** 폴더의 animations.json. 아직 안 불러왔으면 null */
export function frameAnimations(folder: string): readonly (readonly StageAnimationEntry[])[] | null {
  return spriteJsonNow<readonly (readonly StageAnimationEntry[])[]>(`${folder}/animations.json`)
}

// ── 대체 팔레트(.mpl) 갈아 끼우기 ───────────────────────────────────────────
// <img> 쪽은 `shared/lib/sprite/paletteSwap` 의 훅이 맡지만 캔버스에는 훅을 쓸 수 없어
// 원점·애니 표와 같은 공용 JSON 캐시(비동기로 받아 두고 도착하면 다음 프레임부터)를 쓴다.

/** 폴더의 palette.json. 아직 안 불러왔으면 null (DOM 의 `useSpritePalettes` 와 같은 캐시) */
function spritePalettes(folder: string): SpritePalettes | null {
  return spriteJsonNow<SpritePalettes>(paletteUrl(`${folder}/000.png`))
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
      if (image !== null) {
        painted.set(key, image)
        noteAssetLoaded()
      }
    })
    .catch(() => {})
  return sprite(url)
}

/**
 * 프레임 한 장의 칠하기를 미리 건다 — 그리기 전에 칠해 두면 처음 그리는 그림에 구운 벌이 비치지 않는다.
 * 원점 · `palette.json` 이 아직 안 왔으면 걸지 못해 false(다음에 다시 부른다). 칠하기를 걸었거나 칠할 것이 없으면 true.
 *
 * 2026-10-25 플레이 점검(r177): 타자 스윙 프레임은 처음 스윙하는 틱에 처음 칠하기를 걸어서, 칠이 끝날 때까지(맞은 뒤 멈춤 틱 동안)
 * 몸통 · 헬멧이 구운 벌(파란 헬멧)로 그려졌다 — 원본은 팔레트를 적재 때 갈아 끼우므로 그런 깜박임이 없다.
 */
export function warmRecoloredFrame(folder: string, index: number, paletteIndex: number): boolean {
  // 같이 청한다 — 원점이 올 때까지 팔레트 받기를 미루지 않는다.
  // 0x67 겹이 있는 폴더(하늘 조명)는 `drawFrameAt` 이 겹 그림을 칠해 그리므로 겹 목록도 받아 그 겹까지 건다
  const origins = frameOrigins(folder)
  const palettes = spritePalettes(folder)
  const listing = hasFrameLayers(folder) ? spriteJsonNow<FrameLayerListing>(frameLayersUrl(folder)) : undefined
  if (origins === null) return false
  const key = String(index).padStart(3, '0')
  if (origins[key] === undefined) return true
  if (palettes === null || listing === null) return false
  recoloredSprite(folder, `${folder}/${key}.png`, paletteIndex)
  for (const entry of listing?.[key] ?? []) recoloredSprite(folder, frameLayerUrl(folder, entry), paletteIndex)
  return true
}

/** 미리 칠할 프레임 하나 — 벌이 null 이면 구운 그림이라 칠할 것이 없다 */
export interface RecolorFrame {
  readonly folder: string
  readonly frame: number
  readonly paletteIndex: number | null
}

/** 칠하기를 다 걸어 둔 묶음 열쇠 */
const warmedFrameSets = new Set<string>()

/**
 * 한 그림 객체가 그릴 수 있는 프레임 전부의 칠하기를 미리 건다 (`warmRecoloredFrame`) — 원본은 팔레트를 적재 때 갈아 끼우므로
 * 어느 자세든 처음부터 제 색이다. 웹은 칠하기가 비동기라 처음 그리는 자세에 구운 벌이 한 박자 비치던 것을 막는다.
 * `key` 는 그 묶음(그림 · 벌)을 가린다 — 원점 · 팔레트가 다 와서 다 걸면 같은 열쇠는 다시 안 본다(목록도 안 만든다).
 */
export function warmRecoloredFrames(key: string, framesOf: () => readonly RecolorFrame[]): void {
  if (warmedFrameSets.has(key)) return
  let isAllWarmed = true
  for (const { folder, frame, paletteIndex } of framesOf()) {
    if (paletteIndex !== null && !warmRecoloredFrame(folder, frame, paletteIndex)) isAllWarmed = false
  }
  if (isAllWarmed) warmedFrameSets.add(key)
}

/** 시험 전용 — 다 건 묶음 기억을 비운다 */
export function resetWarmedRecolorsForTest(): void {
  warmedFrameSets.clear()
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
export function placedFrame(
  folder: string,
  index: number,
  paletteIndex: number | null = null,
  isFlipped = false,
): PlacedFrame | null {
  const origins = frameOrigins(folder)
  if (origins === null) return null

  const key = String(index).padStart(3, '0')
  const origin = origins[key]
  if (origin === undefined) return null

  // 효과 0x11(뒤집기)로 부르면 0xc9f98 ca07c 갈래 — 0x66 반투명 파트도 섞지 않고 복사한 판(`frameCopies`)을 쓴다.
  // 목록이 아직이면 구운 프레임(예전 근사). 복사판에는 팔레트 번호 지도가 없어 다시 칠하는 그림은 구운 판 그대로다
  // (복사판 폴더 — 머리 장비 · player_effect · event_char — 는 타석에서 다시 칠하지 않는다)
  const url = isFlipped && paletteIndex === null && hasFrameCopies(folder)
    ? flippedFrameUrlOf(folder, index, spriteJsonNow<unknown>(frameCopiesUrl(folder)))
    : `${folder}/${key}.png`
  const image = paletteIndex === null ? sprite(url) : recoloredSprite(folder, url, paletteIndex)
  if (image === null) return null
  return { image, offsetX: origin.x, offsetY: origin.y }
}

/**
 * 0x67(더하기) 파트가 든 프레임의 겹 (`shared/lib/sprite/frameLayers`). `FRAME_LAYER_FOLDERS` 폴더만 목록을 청한다 —
 * 겹 목록 · 겹 그림이 아직 안 왔거나 그 프레임에 0x67 파트가 없으면 null 이라 부르는 쪽은 구운 프레임(`placedFrame`)을 그린다.
 * `paletteIndex` 는 `placedFrame` 과 같다 — 겹 번호 지도는 `frames/layers/index/` 에 있다.
 */
export function placedFrameLayers(
  folder: string,
  index: number,
  paletteIndex: number | null = null,
): readonly PlacedFrameLayer[] | null {
  if (!hasFrameLayers(folder)) return null
  return placedFrameLayersOf(folder, index, spriteJsonNow<FrameLayerListing>(frameLayersUrl(folder)), (url) =>
    paletteIndex === null ? sprite(url) : recoloredSprite(folder, url, paletteIndex),
  )
}

/**
 * 프레임 한 장을 (x, y) 기준에 그린다 — 겹이 있으면 0x67 파트를 화면에 더하고(`drawFrameLayers`), 없으면 구운 프레임.
 * `partEffects` 는 부른 쪽 효과가 0 인가(0xc9f98 ca198) — 0x11 뒤집기로 부르면 거짓.
 * 그린 것이 없으면(구운 프레임도 아직) false.
 */
export function drawFrameAt(
  context: CanvasRenderingContext2D,
  folder: string,
  index: number,
  x: number,
  y: number,
  options: { readonly paletteIndex?: number | null; readonly partEffects?: boolean } = {},
): boolean {
  const layers = placedFrameLayers(folder, index, options.paletteIndex ?? null)
  if (layers !== null) {
    drawFrameLayers(context, layers, x, y, options.partEffects ?? true)
    return true
  }
  const placed = placedFrame(folder, index, options.paletteIndex ?? null)
  if (placed === null) return false
  context.drawImage(placed.image, x + placed.offsetX, y + placed.offsetY)
  return true
}

/** 마선수가 아닐 때 마운드에 서는 평범한 투수 */
export const PITCHER_FRAMES = './sprites/pitcher/frames'

/** 타석 배경 폴더 (위치 분석 6차) */
export const CLOUD_FRAMES = './sprites/attack_sky_cloud/frames'
/** 하늘 조명 `effect/sky_effect_light.pzx` — 구장+0x38, 그리기 0x78490 */
export const SKY_LIGHT_FRAMES = './sprites/sky_effect_light/frames'
export const FENCE_FRAMES = './sprites/fence/frames'
export const CROWD_FRAMES = './sprites/ppl/frames'
export const SCOREBOARD_FRAMES = './sprites/board_ani/frames'
export const TEAM_ICON = (index: number) => `./sprites/team_s_icon/${String(index).padStart(3, '0')}.png`

// ── 시즌 구장 (0x77494) ─────────────────────────────────────────────────────
// 적재 0x76ba4 의 **시즌 쪽 가지**(두 번째 인자 ≠ 0)가 쓰는 파일들이다.
// 일반 경기는 fence.pzf 한 벌만 쓰지만(위 FENCE_FRAMES), 시즌 홈경기·구장 화면은
// 관중석 칸(+0x88)·관중 단계(+0x89)·전광판 칸(+0x8a) 셋으로 그림을 고른다 (R6 1절).

/** 관중석 0~3 — `stadium/fence_season.pzf` (0x76c62). 한 관중석당 5칸씩 20칸 */
export const FENCE_SEASON_FRAMES = './sprites/fence_season/frames'
/** 관중석 4~6 = 히든 — `stadium/hidden_fence_(칸−4).pzx` (0x76ca2, 5칸씩) */
export const HIDDEN_FENCE_FRAMES = (index: number) => `./sprites/hidden_fence_${index}/frames`
/** 전광판 0~3 — `stadium/fence_board.pzx` (0x76d06), 프레임 번호 = 칸 */
export const FENCE_BOARD_FRAMES = './sprites/fence_board/frames'
/** 전광판 4~6 = 히든 — `stadium/hidden_board_(칸−4).pzx` (0x76d1c), 늘 프레임 0 */
export const HIDDEN_BOARD_FRAMES = (index: number) => `./sprites/hidden_board_${index}/frames`
