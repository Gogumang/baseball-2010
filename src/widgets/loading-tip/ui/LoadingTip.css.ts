import { globalStyle, style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { LOADING_BACKGROUND_RGB, LOADING_BOX, LOADING_TIP_TEXT } from '@/widgets/loading-tip/lib/loadingTipLayout'

/** 화면 전체를 0x53e5a 의 RGB(0x11, 0x20, 0x7f) 로 덮는다 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 20,
  background: `rgb(${LOADING_BACKGROUND_RGB.join(', ')})`,
})

/** 프레임 0 상자 — ((W − 170) >> 1, (H − 147) >> 1) (53ea8 · 53ebe) */
export const box = style({
  position: 'absolute',
  left: `${LOADING_BOX.x}px`,
  top: `${LOADING_BOX.y}px`,
  width: `${LOADING_BOX.width}px`,
  height: `${LOADING_BOX.height}px`,
})

/** 진행 막대 · 채움 띠 (0x6a9f1 사각 칠) */
export const bar = style({
  position: 'absolute',
})

export const sprite = style({
  position: 'absolute',
  left: 0,
  top: 0,
  imageRendering: 'pixelated',
})

/** 팁 글 0xba269(글, X + 10, Y + 30, 폭 w − 20, 색 −1) — 높이 제한이 없어 자르지 않는다 */
export const tipArea = style({
  position: 'absolute',
  left: `${LOADING_TIP_TEXT.x}px`,
  top: `${LOADING_TIP_TEXT.y}px`,
  width: `${LOADING_TIP_TEXT.width}px`,
  color: ORIGINAL_COLORS.text,
})

globalStyle(`${tipArea} p`, {
  fontSize: '11px',
  lineHeight: 14 / 11,
})
