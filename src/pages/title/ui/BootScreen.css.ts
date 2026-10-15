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

/** 0x6ef4c 가 접은 한 줄 — 줄 높이 = 글꼴 높이 + 줄간 = 14 (0x6ef8a~0x6efa4, 줄 높이 인자 −1). 글꼴은 웹 글자(근사) */
export const textLine = style({
  position: 'absolute',
  width: 200,
  height: 14,
  color: '#000000',
  fontSize: '11px',
  lineHeight: '14px',
  whiteSpace: 'pre',
})
