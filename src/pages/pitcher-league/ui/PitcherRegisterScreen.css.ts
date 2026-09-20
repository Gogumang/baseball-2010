import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 등록 줄 한 개 — 이름표 · 값 · 좌우 화살표 */
export const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '2px 0',
})

export const rowSelected = style({
  outline: `1px solid ${ORIGINAL_COLORS.highlightYellow}`,
})

export const label = style({
  width: '52px',
  color: ORIGINAL_COLORS.tableDivider,
  fontSize: '9px',
})

export const value = style({
  flex: 1,
  color: ORIGINAL_COLORS.text,
  fontSize: '10px',
})

export const arrow = style({
  border: 'none',
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  cursor: 'pointer',
  fontSize: '10px',
  padding: '0 2px',
})

export const nameField = style({
  flex: 1,
})

/** 기본 변화구 8칸 — 두 개만 고를 수 있다 (StrMODE[13]) */
export const pitchGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '2px',
})

export const pitchCell = style({
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  fontSize: '9px',
  padding: '2px',
  cursor: 'pointer',
})

export const pitchCellChosen = style({
  borderColor: ORIGINAL_COLORS.highlightYellow,
  color: ORIGINAL_COLORS.highlightYellow,
})
