import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const hint = style({
  margin: 0,
  fontSize: '11px',
  color: theme.color.inkFaint,
  textAlign: 'center',
  lineHeight: 1.6,
})

export const notice = style({
  margin: 0,
  fontSize: '12px',
  color: theme.color.inkDim,
})

export const bigResult = style({
  textAlign: 'center',
  fontSize: '22px',
  fontWeight: 700,
  color: theme.color.accent,
  padding: '6px 0',
})
