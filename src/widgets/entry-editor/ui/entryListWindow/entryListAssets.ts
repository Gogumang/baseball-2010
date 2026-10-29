/** 엔트리 목록 창이 쓰는 그림 자리 · 공용 그림 꼴 */
import type { CSSProperties } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const NUM = assetUrl('./sprites/num')
export const pad = (index: number): string => String(index).padStart(3, '0')
export const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }
export const WHITE = ORIGINAL_COLORS.text
