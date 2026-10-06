import { style } from '@vanilla-extract/css'

/** 타석 캔버스(240×320) 위에 그대로 겹치는 판 — 안쪽은 전부 절대 좌표다 */
export const hud = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
})

/** 원본 좌표 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
})
