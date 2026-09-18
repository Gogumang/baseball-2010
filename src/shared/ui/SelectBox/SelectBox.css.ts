import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const fieldLabel = style({
  display: 'block',
  marginBottom: '4px',
  fontSize: '10px',
  color: theme.color.inkDim,
})

export const field = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  width: '100%',
  minHeight: '34px',
  padding: '0 10px',
  border: `2px solid ${theme.color.line}`,
  borderRadius: '8px',
  background: theme.color.panelRaised,
  color: theme.color.ink,
  font: 'inherit',
  fontSize: '13px',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:focus-visible, &[aria-expanded="true"]': {
      outline: 'none',
      borderColor: theme.color.accent,
    },
  },
})

export const fieldValue = style({ flex: 1 })

export const placeholder = style({ flex: 1, color: theme.color.inkFaint })

export const chevron = style({
  flex: 'none',
  fontSize: '10px',
  color: theme.color.inkDim,
})

export const option = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  minHeight: '44px',
  padding: '6px 14px',
  border: 'none',
  background: 'none',
  color: theme.color.ink,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&[data-highlighted="true"]': { background: theme.color.panelRaised },
    '&:disabled': { color: theme.color.inkFaint, cursor: 'default' },
  },
})

export const optionText = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: '2px',
})

export const optionLabel = style({ fontSize: '13px', fontWeight: 700 })

export const optionDescription = style({
  fontSize: '10px',
  lineHeight: 1.4,
  color: theme.color.inkDim,
  selectors: {
    [`${option}:disabled &`]: { color: theme.color.inkFaint },
  },
})

export const check = style({
  flex: 'none',
  width: '14px',
  fontSize: '13px',
  color: theme.color.accent,
})
