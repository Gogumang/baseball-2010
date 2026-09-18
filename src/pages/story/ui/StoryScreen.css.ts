import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 초상화 판 높이. 가장 큰 인물(event_char_1, 101px)이 들어가는 값 — 원작 세로 위치는 **추정**이다. */
export const PORTRAIT_HEIGHT = 104

export const nameTag = style({
  alignSelf: 'flex-start',
  marginBottom: '-8px',
  padding: '1px 8px',
  border: `2px solid ${theme.color.line}`,
  borderBottom: 'none',
  background: theme.color.panelRaised,
  color: theme.color.accent,
  fontSize: '11px',
  fontWeight: 700,
})
