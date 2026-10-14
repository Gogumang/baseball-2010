import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

export const overlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  cursor: 'pointer',
})

export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 메시지 줄 — 흰 글자, 16px 간격, 상자 밖은 잘린다 (0x8a18a) */
export const messages = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: '2px 6px',
  overflow: 'hidden',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '16px',
  whiteSpace: 'nowrap',
})
