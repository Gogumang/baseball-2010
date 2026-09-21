import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** ⚠️ 원본 배치 미해독 — 공용 판 0x55e60 관례로 그린다 */
export const panel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

export const title = style({
  position: 'absolute',
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '13px',
  color: ORIGINAL_COLORS.text,
  pointerEvents: 'none',
})

export const round = style({
  position: 'absolute',
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '13px',
  color: ORIGINAL_COLORS.highlightYellow,
  pointerEvents: 'none',
})

export const logo = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const teamName = style({
  position: 'absolute',
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '13px',
  color: ORIGINAL_COLORS.text,
  pointerEvents: 'none',
})

export const vs = style({
  position: 'absolute',
  width: '100%',
  textAlign: 'center',
  fontSize: '22px',
  lineHeight: '22px',
  color: ORIGINAL_COLORS.highlightYellow,
  pointerEvents: 'none',
})

export const hint = style({
  position: 'absolute',
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '13px',
  color: ORIGINAL_COLORS.text,
  pointerEvents: 'none',
})

export const buttons = style({
  position: 'absolute',
  display: 'flex',
  justifyContent: 'center',
  gap: '10px',
})
