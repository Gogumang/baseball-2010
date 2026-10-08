import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 240×320 화면 좌표 그대로 놓는 판 — 상자 바깥은 누르기를 막지 않는다 */
export const root = style({
  position: 'absolute',
  inset: 0,
  zIndex: 30,
  pointerEvents: 'none',
})

/** 띠 · 본체 · 글을 누르면 확인 키(0x8b804)와 같다 */
export const hit = style({
  position: 'absolute',
  left: 0,
  width: '240px',
  bottom: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  pointerEvents: 'auto',
})

export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 글 한 줄 — 0x6ef4c 줄 높이 14 · 흰색 */
export const textLine = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
  whiteSpace: 'pre',
  overflow: 'hidden',
  pointerEvents: 'none',
})
