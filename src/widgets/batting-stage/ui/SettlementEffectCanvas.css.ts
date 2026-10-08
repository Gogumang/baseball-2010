import { style } from '@vanilla-extract/css'

/** 판(240×320, 원본 절대 좌표) 안에 겹치는 효과 층 — 누르기는 밑의 판 단추로 흘린다 */
export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  pointerEvents: 'none',
  imageRendering: 'pixelated',
})
