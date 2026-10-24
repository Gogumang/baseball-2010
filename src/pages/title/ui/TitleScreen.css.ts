import { style } from '@vanilla-extract/css'

/** 애니 0 · 1 을 그리는 240×320 캔버스 (0x67 더하기가 화면을 읽는다) */
export const canvas = style({
  position: 'absolute',
  left: 0,
  top: 0,
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 캔버스 위 효과 없는 그림 (저작권 · 판 번호 · 전체이용가) */
export const overCanvas = style({
  position: 'absolute',
  zIndex: 1,
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})
