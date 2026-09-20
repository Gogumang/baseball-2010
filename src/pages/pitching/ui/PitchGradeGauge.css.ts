import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 원 한 장이 들어갈 자리 — 가장 큰 프레임이 43px 이다 */
export const gauge = style({
  position: 'relative',
  display: 'block',
  width: '100%',
  height: '56px',
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
})

export const circle = style({
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  borderRadius: '50%',
})

/** 프레임 0x3a — 반투명 어두운 테두리 원 */
export const outline = style({
  border: `2px solid ${theme.color.line}`,
  background: 'rgba(0, 0, 0, 0.35)',
})

export const hint = style({
  position: 'absolute',
  left: 0,
  bottom: 0,
  fontSize: '11px',
  color: theme.color.inkDim,
})
