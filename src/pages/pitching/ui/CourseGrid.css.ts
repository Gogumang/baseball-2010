import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 원작 코스 선택은 3×3이다 (StrHOWTO <투구 조작> 2단계). */
export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '2px',
  width: '120px',
  margin: '0 auto',
  border: `2px solid ${theme.color.accent}`,
  background: '#0c1222',
})

export const cell = style({
  aspectRatio: '1',
  border: `1px solid ${theme.color.line}`,
  background: 'none',
  color: theme.color.inkDim,
  font: 'inherit',
  cursor: 'pointer',
  selectors: {
    '&[aria-selected="true"]': {
      background: theme.color.panelRaised,
      color: theme.color.accent,
    },
  },
})
