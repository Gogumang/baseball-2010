import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const panel = style({
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
  padding: '9px 10px',
})

export const heading = style({
  margin: '0 0 7px',
  fontSize: '12px',
  color: theme.color.accent,
  fontWeight: 700,
})
