import { style } from '@vanilla-extract/css'

/** 켤 때 두 화면(이용안내 0x2a · 로고 2)의 흰 바탕 — 0x2cade `0x6a9f1(0, 0, W, H, 흰색)` · 0x68c54 (상태 ≤ 5) */
export const whiteBackground = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  background: '#ffffff',
})

export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 글 상자 — x 20 · 폭 W − 40 = 200 (0xba269 의 둘째·넷째 인자), 글색 검정 (0x1400748(0,0,0)) */
export const textBox = style({
  position: 'absolute',
  left: 20,
  width: 200,
  color: '#000000',
})
