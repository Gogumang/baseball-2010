import { style } from '@vanilla-extract/css'

const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 배경 구멍 아래로 비쳐 보여야 하는 조각 (선수·로고) */
export const underBackground = style([layer, { zIndex: 1 }])
export const background = style([layer, { zIndex: 2, left: 0, top: 0 }])
export const overBackground = style([layer, { zIndex: 3 }])
