import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

export const box = style({
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
  padding: '10px',
  minHeight: '96px',
})

/** 대사창 전체가 '다음 줄로' 버튼이다 — 버튼 기본 모양만 지운다. */
export const dialogueButton = style([
  box,
  {
    textAlign: 'left',
    font: 'inherit',
    color: 'inherit',
    width: '100%',
    cursor: 'pointer',
  },
])
