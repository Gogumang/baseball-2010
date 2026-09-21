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

/**
 * PZX 프레임이 들고 있는 사각형 `[x, y, 폭, 높이]` — 원본 0x94a64(out, 프레임, 0, k) 가 k번을 돌려준다.
 * 화면 배치가 이 값을 쓴다 (예: mode_ui 프레임 2 의 0번 = 등록 화면 정보 판 (21,176,196,83)).
 *
 * 값은 **프레임 좌표 그대로**다. 합성 PNG 는 바운딩 박스로 잘려 있으므로 PNG 안 좌표로 쓰려면
 * `origins.json` 의 x·y 를 빼야 한다. 박스가 없는 프레임은 아예 들어 있지 않다.
 */
export type FrameBox = readonly [x: number, y: number, width: number, height: number]

export type FrameBoxes = Readonly<Record<string, readonly FrameBox[]>>

export function useFrameBoxes(folder: string): FrameBoxes | null {
  return useSpriteJson<FrameBoxes>(`${folder}/boxes.json`)
}

/** 프레임 번호(정수)로 박스를 찾는다. 없으면 빈 목록이다. */
export function frameBoxesOf(boxes: FrameBoxes | null, frame: number): readonly FrameBox[] {
  return boxes?.[String(frame).padStart(3, '0')] ?? []
}
