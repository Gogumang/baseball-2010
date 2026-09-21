import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const frame = style({
  position: 'relative',
})

/** 이닝·아웃·주자·점수 한 줄 */
export const hud = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '3px 4px',
  background: theme.color.hudRow,
  fontSize: '11px',
  color: theme.color.ink,
})

export const score = style({
  marginLeft: 'auto',
  color: theme.color.accent,
})

export const bases = style({
  display: 'flex',
  gap: '4px',
  fontSize: '11px',
  color: theme.color.inkFaint,
})

export const baseOn = style({
  color: theme.color.accent,
})

export const count = style({
  display: 'flex',
  gap: '6px',
  padding: '3px 4px',
  fontSize: '11px',
  color: theme.color.inkDim,
})

export const lamp = style({
  color: theme.color.inkFaint,
  selectors: {
    '&[data-on="true"]': { color: theme.color.accent },
  },
})

export const staminaTrack = style({
  position: 'relative',
  height: '8px',
  margin: '4px 0',
  border: `1px solid ${theme.color.line}`,
  background: theme.color.surfaceDeep,
})

export const staminaFill = style({
  height: '100%',
  background: theme.color.accent,
  selectors: {
    '&[data-low="true"]': { background: '#ef4d42' },
  },
})

export const stageArea = style({
  position: 'relative',
})

export const log = style({
  margin: '6px 0 0',
  padding: 0,
  listStyle: 'none',
  fontSize: '11px',
  color: theme.color.inkDim,
})

export const logLine = style({
  padding: '1px 0',
  selectors: {
    '&[data-mine="true"]': { color: theme.color.ink },
  },
})
