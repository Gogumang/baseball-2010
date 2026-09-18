import { style } from '@vanilla-extract/css'

/** 원본 이벤트 텍스트는 줄바꿈이 의미를 갖는다 — 그대로 지킨다. */
export const dialogueText = style({
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
})
