import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 공용 창 0x55e60 */
export const panel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 탭 — 눌림만 받고 그림은 막대 프레임이 그린다 */
export const tab = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  cursor: 'pointer',
})

/** 칸 격자 한 칸 — 그림은 프레임이 그리고 글만 얹는다 */
export const cell = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  fontSize: '9px',
  lineHeight: '10px',
  cursor: 'pointer',
})

/** 칸 이름 — 검정 그림자(x, y+7) 위에 흰 글(x−1, y+6) */
export const cellShadow = style({
  position: 'absolute',
  color: '#000000',
  textAlign: 'center',
  fontSize: '9px',
  lineHeight: '10px',
  pointerEvents: 'none',
})

export const cellName = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  fontSize: '9px',
  lineHeight: '10px',
  pointerEvents: 'none',
})

export const rowText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '10px',
  lineHeight: '10px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** `"!C!cffff00%d/%d"` — 합계는 노랑 가운데 */
export const totalValue = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.highlightYellow,
  textAlign: 'center',
  fontSize: '10px',
  lineHeight: '10px',
  pointerEvents: 'none',
})

/** `"!C!cffffff%d%%"` — 진행도는 흰 가운데 */
export const progressValue = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  fontSize: '10px',
  lineHeight: '10px',
  pointerEvents: 'none',
})

export const descriptionBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '2px',
  background: '#213473',
  pointerEvents: 'none',
})

export const descriptionText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '10px',
  lineHeight: '12px',
  whiteSpace: 'pre-line',
  pointerEvents: 'none',
})

export const pagerText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '10px',
  lineHeight: '10px',
  pointerEvents: 'none',
})

export const backButton = style({
  position: 'absolute',
  right: '4px',
  top: '4px',
})
