import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * 못 쓰는 칸 — 원본에 있는 칸이라 지우지 않고 흐리게만 그린다.
 * (원본에는 이런 상태가 없다. 통신 기능·아직 안 만든 화면을 구분해 보여 주려고 웹판이 더한 것이다.)
 */
export const dimmed = style({
  filter: 'grayscale(1)',
  opacity: 0.4,
})

/** 줄 하나 — 그림은 따로 그리고 눌림만 받는 투명 칸이다 */
export const row = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  cursor: 'pointer',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
})

/** 설명 판 안 글 — RGB(128,128,128) 회색, 11px 줄 */
export const description = style({
  position: 'absolute',
  fontSize: '11px',
  lineHeight: '12px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 바닥띠 되돌아가기 표시 (바닥 비트 0x4) */
export const backButton = style({
  position: 'absolute',
  display: 'block',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  imageRendering: 'pixelated',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
})
