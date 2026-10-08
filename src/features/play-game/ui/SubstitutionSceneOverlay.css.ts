import { style } from '@vanilla-extract/css'

/** 타석 캔버스(240×320) 위에 겹치는 판 — 글자가 왼쪽 밖에서 미끄러져 들어오므로 캔버스 밖은 잘라 낸다 */
export const stage = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  overflow: 'hidden',
  pointerEvents: 'none',
})
