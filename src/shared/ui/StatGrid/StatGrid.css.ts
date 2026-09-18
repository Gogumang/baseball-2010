import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 원작 성적표와 같은 3열 배치. 항목이 늘어도 줄만 늘어난다. */
export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '7px 6px',
  fontSize: '11px',
})

export const cell = style({
  display: 'flex',
  flexDirection: 'column',
})

export const label = style({
  color: theme.color.inkDim,
})

export const value = style({
  fontSize: '13px',
  fontWeight: 700,
})
