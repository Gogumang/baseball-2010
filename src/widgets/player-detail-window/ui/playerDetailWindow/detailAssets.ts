import type { CSSProperties } from 'react'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 선수 정보 창이 그리는 그림 폴더 — 칸 game_ui · 이름 img_text · 도형 바탕 slt_frame · 숫자 num */
export const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const NUM = assetUrl('./sprites/num')
export const pad = (index: number) => String(index).padStart(3, '0')
export const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }
