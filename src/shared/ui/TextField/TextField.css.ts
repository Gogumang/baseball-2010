import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const field = style({
  width: '100%',
  padding: '10px',
  background: theme.color.surfaceDeep,
  border: `2px solid ${theme.color.line}`,
  color: theme.color.ink,
  font: 'inherit',
  fontSize: '15px',
  selectors: {
    '&:focus': { outline: 'none', borderColor: theme.color.accent },
  },
})
