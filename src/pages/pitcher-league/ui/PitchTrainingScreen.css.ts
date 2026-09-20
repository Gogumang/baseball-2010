import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 구질 표 — 4행 × 5열 (열 4 는 히든) */
export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: '2px',
})

export const cell = style({
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  fontSize: '8px',
  lineHeight: '11px',
  padding: '2px 1px',
  cursor: 'pointer',
})

/** 이미 배운 구질 — 원본도 고르면 아무 말 없이 무시한다 */
export const cellOwned = style({
  color: ORIGINAL_COLORS.highlightYellow,
  borderColor: ORIGINAL_COLORS.highlightYellow,
})

export const cellLocked = style({
  color: ORIGINAL_COLORS.tableDivider,
})

export const cost = style({
  display: 'block',
  fontSize: '7px',
  color: ORIGINAL_COLORS.tableDivider,
})
