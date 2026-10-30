import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
export const TEAM_LOGO = assetUrl('./sprites/team_logo')
export const pad = (index: number) => String(index).padStart(3, '0')

/** 그림 한 장 — 주소 · 왼쪽 위 */
export interface Placed {
  readonly src: string
  readonly x: number
  readonly y: number
}

export function framePlaced(folder: string, frame: number, origins: FrameOrigins, x: number, y: number): Placed | null {
  const origin = origins[pad(frame)]
  return origin === undefined ? null : { src: `${folder}/${pad(frame)}.png`, x: x + origin.x, y: y + origin.y }
}
