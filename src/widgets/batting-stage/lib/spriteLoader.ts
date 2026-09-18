/**
 * 원본에서 뽑은 PNG를 캔버스에 쓰기 위해 불러오고 캐시한다.
 * 아직 안 불러온 그림은 null을 돌려주고, 도착하면 다음 프레임부터 그려진다 —
 * 로딩 때문에 게임 루프가 멈추면 안 된다.
 */

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

/** 프레임 한 장을 원점과 함께 돌려준다. 아직 안 불러왔으면 null. */
export function placedFrame(folder: string, index: number): PlacedFrame | null {
  const origins = frameOrigins(folder)
  if (origins === null) return null

  const key = String(index).padStart(3, '0')
  const origin = origins[key]
  if (origin === undefined) return null

  const image = sprite(`${folder}/${key}.png`)
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
