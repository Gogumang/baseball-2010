import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const frame = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
})

/** 조준점 자르기 범위 (x ±600 · y ±400) */
export const field = style({
  position: 'relative',
  border: `2px solid ${theme.color.accent}`,
  background: theme.color.surfaceDeep,
  overflow: 'hidden',
})

/** 스트라이크 존 */
export const zone = style({
  position: 'absolute',
  border: `1px solid ${theme.color.line}`,
  background: theme.color.panelRaised,
})

export const dot = style({
  position: 'absolute',
  width: '10px',
  height: '10px',
  marginLeft: '-5px',
  marginTop: '-5px',
  borderRadius: '50%',
  border: `2px solid ${theme.color.accent}`,
  background: 'rgba(0, 0, 0, 0.35)',
})

export const keypad = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 36px)',
  gap: '2px',
})

export const key = style({
  height: '30px',
  border: `1px solid ${theme.color.line}`,
  background: theme.color.panel,
  color: theme.color.ink,
  font: 'inherit',
  cursor: 'pointer',
})

export const clear = style({
  border: `1px solid ${theme.color.line}`,
  background: 'none',
  color: theme.color.inkDim,
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
})
