import { style } from '@vanilla-extract/css'

/** 앞 화면 판이 없을 때의 검정 바탕 — 240×320 */
export const host = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '240px',
  height: '320px',
  background: '#000000',
  pointerEvents: 'none',
})
