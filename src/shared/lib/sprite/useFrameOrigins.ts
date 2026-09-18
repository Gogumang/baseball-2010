import { useSpriteJson } from '@/shared/lib/sprite/useSpriteJson'

/** decode_pzx.py 가 합성 프레임마다 남긴 원점 (앵커 기준 좌상단). */
export interface FrameOrigin {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type FrameOrigins = Readonly<Record<string, FrameOrigin>>

/** PZX 애니메이션 한 칸 — 프레임 번호, 지연(갱신 횟수), 그 칸의 이동. */
export interface AnimationEntry {
  readonly frame: number
  readonly delay: number
  readonly dx?: number
  readonly dy?: number
}

export function useFrameOrigins(folder: string): FrameOrigins | null {
  return useSpriteJson<FrameOrigins>(`${folder}/origins.json`)
}

export function useAnimations(folder: string): readonly (readonly AnimationEntry[])[] | null {
  return useSpriteJson<readonly (readonly AnimationEntry[])[]>(`${folder}/animations.json`)
}
