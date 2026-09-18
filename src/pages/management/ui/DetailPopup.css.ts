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

/** 공용 창 0x55e60 — 둥근 판 #335FCD, 검정 테두리, 안쪽 흰 선 (모양은 추정) */
export const window = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
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
