import { style } from '@vanilla-extract/css'

/** 초상화 판. 인물 발밑(원점 y)이 판 바닥에 오도록 부르는 쪽이 높이를 준다. */
export const stage = style({
  position: 'relative',
  flex: 'none',
  width: '240px',
  margin: '0 -10px',
  overflow: 'hidden',
  pointerEvents: 'none',
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
})
