import type { CSSProperties } from 'react'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const MODE_UI_FRAMES = assetUrl('./sprites/mode_ui/frames')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
export const pad = (index: number) => String(index).padStart(3, '0')
export const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }

export type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

/** 확인 판 한 줄 — 이름 · 팀 · 딱지 재료 */
export interface TradeConfirmPlayer {
  readonly name: string
  readonly teamId: number
  /** 레코드 +0xb & 3 */
  readonly profileLow: number
  /** 레코드 +0x1b */
  readonly grade: number
}
