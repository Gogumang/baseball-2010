import { style } from '@vanilla-extract/css'

/** 점수판 틀 한 벌 — 안쪽은 240×320 원본 절대 좌표다 (부르는 쪽 화면이 원점) */
export const group = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  pointerEvents: 'none',
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const block = style({
  position: 'absolute',
  pointerEvents: 'none',
})

export const hiddenSvg = style({
  position: 'absolute',
  width: 0,
  height: 0,
})
