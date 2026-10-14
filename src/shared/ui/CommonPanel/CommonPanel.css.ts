import { style } from '@vanilla-extract/css'

/** 원작 좌표에 그대로 놓는 칠 판(SVG) — 눌림은 받지 않는다 */
export const paint = style({
  position: 'absolute',
  display: 'block',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})
