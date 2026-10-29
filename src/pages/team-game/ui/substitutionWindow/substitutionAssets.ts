import type { CSSProperties } from 'react'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const GAME_UI = assetUrl('./sprites/game_ui')
export const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
export const NUM = assetUrl('./sprites/num')
export const TEAM_LOGO = assetUrl('./sprites/team_logo')
export const pad = (index: number) => String(index).padStart(3, '0')
export const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }
