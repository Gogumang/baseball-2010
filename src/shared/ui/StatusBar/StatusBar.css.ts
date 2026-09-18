import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const bar = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '6px',
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
  padding: '7px 8px',
  fontSize: '11px',
})

export const cell = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
})

/** 칸마다 위가 항목 이름, 아래가 값이다. */
globalStyle(`${cell} span:first-child`, {
  color: theme.color.inkDim,
})

globalStyle(`${cell} span:last-child`, {
  color: theme.color.ink,
  fontSize: '13px',
  fontWeight: 700,
})

export const abilityRow = style({
  display: 'grid',
  gridTemplateColumns: '34px 1fr 26px',
  alignItems: 'center',
  gap: '7px',
  fontSize: '11px',
  marginBottom: '5px',
  selectors: {
    '&:last-child': { marginBottom: 0 },
  },
})

export const abilityTrack = style({
  display: 'block',
  height: '9px',
  background: theme.color.surfaceDeep,
  border: `1px solid ${theme.color.line}`,
})

export const abilityFill = style({
  display: 'block',
  height: '100%',
  background: theme.color.accent,
})

export const abilityValue = style({
  textAlign: 'right',
  fontWeight: 700,
})
