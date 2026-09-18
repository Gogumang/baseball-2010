import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const nameInput = style({
  width: '100%',
  padding: '10px',
  background: '#0c1222',
  border: `2px solid ${theme.color.line}`,
  color: theme.color.ink,
  font: 'inherit',
  fontSize: '15px',
  selectors: {
    '&:focus': { outline: 'none', borderColor: theme.color.accent },
  },
})

export const choices = style({
  display: 'flex',
  gap: '6px',
})

export const choice = style({
  flex: 1,
  padding: '6px 0',
  border: `1px solid ${theme.color.line}`,
  borderRadius: '6px',
  background: 'transparent',
  color: theme.color.inkDim,
  font: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
  selectors: {
    '&[aria-checked="true"]': { background: theme.color.accent, color: theme.color.field, borderColor: theme.color.accent },
  },
})
