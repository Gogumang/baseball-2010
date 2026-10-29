import { type SpritePalettes, paletteUrl } from '@/shared/lib/sprite/paletteSwap'
import { spriteImage, spriteJsonNow } from '@/shared/lib/sprite/spriteCache'

/** 캐시는 DOM·미리 받기와 같이 쓴다 (`shared/lib/sprite/spriteCache`) */
export function sprite(url: string): HTMLImageElement | null {
  return spriteImage(url)
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

export function frameOrigins(folder: string): Readonly<Record<string, FrameOrigin>> | null {
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

/** 폴더의 palette.json. 아직 안 불러왔으면 null */
export function spritePalettes(folder: string): SpritePalettes | null {
  return spriteJsonNow<SpritePalettes>(paletteUrl(`${folder}/000.png`))
}
