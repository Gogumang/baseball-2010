import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 한 줄 높이의 창 — 넘기는 줄은 창 밖으로 잘린다 (0x36714 의 자르기 창) */
export const bar = style({
  position: 'relative',
  overflow: 'hidden',
  height: '25px',
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
  fontSize: '11px',
})

export const goal = style({
  position: 'absolute',
  left: '8px',
  top: '5px',
  whiteSpace: 'nowrap',
  color: theme.color.ink,
})
