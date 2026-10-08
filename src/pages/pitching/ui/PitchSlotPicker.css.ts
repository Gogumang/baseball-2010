import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
})

export const item = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  width: '100%',
  padding: '9px 8px',
  minHeight: '44px',
  background: 'none',
  border: 'none',
  borderBottom: `1px solid ${theme.color.lineMuted}`,
  color: theme.color.ink,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    'li:last-child &': { borderBottom: 'none' },
    '&[aria-pressed="true"]': {
      background: theme.color.panelRaised,
      color: theme.color.accent,
    },
    '&:disabled': { color: theme.color.inkFaint, cursor: 'default' },
  },
})

/** 그 칸의 키 (0x534d8) */
export const key = style({
  flex: 'none',
  minWidth: '24px',
  color: theme.color.accent,
})

export const label = style({ flex: 1 })

export const detail = style({
  display: 'block',
  fontSize: '11px',
  color: theme.color.inkDim,
  lineHeight: 1.45,
})
