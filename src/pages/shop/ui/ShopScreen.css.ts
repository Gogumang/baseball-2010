import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const tabs = style({
  display: 'flex',
  gap: '4px',
  flex: 'none',
})

export const tab = style({
  flex: 1,
  padding: '4px 0',
  border: `1px solid ${theme.color.line}`,
  borderRadius: '6px',
  background: 'transparent',
  color: theme.color.inkDim,
  font: 'inherit',
  fontSize: '10px',
  cursor: 'pointer',
  selectors: {
    '&[aria-selected="true"]': { background: theme.color.accent, color: theme.color.field, borderColor: theme.color.accent },
  },
})
