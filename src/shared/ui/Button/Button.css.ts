import { style, styleVariants } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const base = style({
  border: 'none',
  font: 'inherit',
  cursor: 'pointer',
  selectors: {
    '&:disabled': { opacity: 0.45, cursor: 'default' },
    '&:focus-visible': { outline: `2px solid ${theme.color.ink}`, outlineOffset: '2px' },
  },
})

export const variant = styleVariants({
  primary: {
    minHeight: '38px',
    borderRadius: '8px',
    background: theme.color.accent,
    color: theme.color.inkOnAccent,
    fontSize: '14px',
    fontWeight: 700,
  },
  corner: {
    padding: '3px 8px',
    borderRadius: '6px',
    background: theme.color.scrimStrong,
    color: theme.color.ink,
    fontSize: '10px',
  },
  segment: {
    flex: 1,
    padding: '6px 4px',
    border: `1px solid ${theme.color.line}`,
    borderRadius: '6px',
    background: 'transparent',
    color: theme.color.inkDim,
    fontSize: '12px',
    selectors: {
      '&[aria-checked="true"], &[aria-selected="true"]': {
        background: theme.color.accent,
        color: theme.color.inkOnAccent,
        borderColor: theme.color.accent,
      },
    },
  },
  text: {
    padding: '0 4px',
    background: 'transparent',
    color: theme.color.titleBarBottom,
    fontWeight: 700,
  },
})
