import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const gauge = style({
  display: 'block',
  width: '100%',
  padding: '8px',
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
})

export const track = style({
  position: 'relative',
  display: 'block',
  height: '14px',
  background: theme.color.surfaceDeep,
  border: `1px solid ${theme.color.line}`,
})

/** 가운데 이 구간에서 멈추면 PERFECT다. */
export const perfectZone = style({
  position: 'absolute',
  left: '47%',
  width: '6%',
  height: '100%',
  background: theme.color.accentWash,
})

export const fill = style({
  position: 'absolute',
  left: 0,
  height: '100%',
  background: theme.color.accent,
})

export const label = style({
  display: 'block',
  marginTop: '5px',
  fontSize: '11px',
  color: theme.color.accent,
})
