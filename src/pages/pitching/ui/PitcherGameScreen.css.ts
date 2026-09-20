import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const frame = style({
  position: 'relative',
})

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

/** 볼·스트라이크·아웃 램프 */
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

/** 스태미나 막대 — 원본은 체력%를 4단계(0x3493c)로 보여 준다 */
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

export const bases = style({
  display: 'flex',
  gap: '4px',
  fontSize: '11px',
  color: theme.color.inkFaint,
})

export const baseOn = style({
  color: theme.color.accent,
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
