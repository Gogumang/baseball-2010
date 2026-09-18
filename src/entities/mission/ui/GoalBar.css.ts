import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const bar = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '5px',
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
  padding: '6px 8px',
  fontSize: '11px',
})

export const goal = style({
  border: `1px solid ${theme.color.line}`,
  padding: '1px 5px',
  color: theme.color.inkDim,
})

export const achieved = style({
  borderColor: theme.color.accentDeep,
  color: theme.color.accent,
})
