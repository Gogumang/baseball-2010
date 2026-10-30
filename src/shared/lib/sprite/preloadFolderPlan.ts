import { hasFrameLayers } from '@/shared/lib/sprite/frameLayers'
import { hasFrameCopies } from '@/shared/lib/sprite/frameCopies'
import { animationFramesOf } from '@/shared/lib/sprite/spritePreloadLists'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreloadTypes'

/**
 * **폴더 하나의 받을 프레임 정하기** — 미리 받기(`createSpritePreloader` 의 `preloadFolder`)가 표를 받는 사이사이에 부르는 동기 판단들.
 * 표 받기(`await`)는 부르는 쪽에 그대로 둔다 — 받는 차례 · 걸음이 예전과 같아야 그림 요청 차례가 같다.
 */

/** 프레임 칸을 정하려고 받을 원점 표 — `'all'` 이면 이 폴더 것, 원점으로 거르면 그 폴더 것, 아니면 없음 */
export function framesOriginsUrlOf(request: SpriteFolderPreload): string | null {
  if (request.frames === 'all') return `${request.folder}/origins.json`
  if (request.framesListedIn !== undefined && request.frames.length > 0) return `${request.framesListedIn}/origins.json`
  return null
}

/** 받은 원점 표(못 받았으면 null)로 정한 프레임 — `'all'` 은 표의 칸 전부, 거르기는 표에 있는 칸만(표가 없으면 목록대로) */
export function framesAfterOrigins(request: SpriteFolderPreload, origins: unknown): readonly number[] {
  const listed = origins !== null && typeof origins === 'object' ? (origins as Record<string, unknown>) : null
  if (request.frames === 'all') {
    return listed === null
      ? []
      : Object.keys(listed)
          .map(Number)
          .filter((frame) => Number.isInteger(frame))
  }
  // 원점 표를 못 받았으면 목록대로 받는다(없는 칸은 실패로 끝날 뿐 진행은 같다)
  if (request.framesListedIn === undefined || request.frames.length === 0 || listed === null) return request.frames
  return request.frames.filter((frame) => String(frame).padStart(3, '0') in listed)
}

/** 애니 번호로 더 받을 프레임의 표 — 애니가 없으면 null */
export function animationsUrlOf(request: SpriteFolderPreload): string | null {
  if (request.animations === undefined || request.animations.length === 0) return null
  return `${request.animationsIn ?? request.folder}/animations.json`
}

/** 프레임에 애니 표의 프레임을 더한다(처음 나온 차례) */
export function withAnimationFrames(frames: readonly number[], table: unknown, animations: readonly number[]): readonly number[] {
  return [...new Set([...frames, ...animationFramesOf(table, animations)])]
}

/** 0x67(더하기) 파트가 든 폴더면 받는 프레임의 겹 그림도 받는다 — 그리기(`drawFrameAt`)가 구운 프레임 대신 겹을 쓴다 */
export const needsFrameLayers = (folder: string, frames: readonly number[]) => hasFrameLayers(folder) && frames.length > 0

/** 반투명 파트를 뒤집어(0x11) 그리는 폴더면 복사판도 받는다 — 뒤집을지는 그릴 때 정해지므로 목록에 든 칸을 다 받는다(`frameCopies`) */
export const needsFrameCopies = (folder: string, frames: readonly number[]) => hasFrameCopies(folder) && frames.length > 0
