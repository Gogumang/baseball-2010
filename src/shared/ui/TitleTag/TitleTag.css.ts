import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const tag = style({
  display: 'inline-block',
  border: `1px solid ${theme.color.accentDeep}`,
  color: theme.color.accent,
  padding: '1px 6px',
  margin: '0 4px 4px 0',
  fontSize: '11px',
})
