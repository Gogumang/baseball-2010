import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
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

/** 설명 판 안 글 — RGB(128,128,128) 회색, 11px 줄 (0x55545) */
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

/** 본문 창 = 공용 판 0x55e61 (기록연감·환경설정과 같은 가운데 192 판) */
export const panel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

/** 쪽 제목 — 흰 글 */
export const bodyTitle = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
})

/** 본문 글 — StrHOWTO 원문 마크업 그대로 */
export const bodyText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '10px',
  lineHeight: '12px',
  overflowY: 'auto',
})

/** 쪽 번호 */
export const pagerText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '10px',
  lineHeight: '12px',
  pointerEvents: 'none',
})
