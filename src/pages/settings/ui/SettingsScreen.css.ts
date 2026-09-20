import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 공용 창 0x55e60 — #335FCD 둥근 판 + #080408 1px 테두리, 안쪽 흰 선 */
export const panel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 줄 하나 — 눌림을 받는 자리는 막대 크기다 */
export const row = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  cursor: 'pointer',
})

/** 값 줄 이름 — `"!cffffff%s"` 흰색 */
export const valueName = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 메뉴 줄 이름 — `"!C!c7B93D4%s"` 가운데 정렬 */
export const menuName = style({
  position: 'absolute',
  color: '#7B93D4',
  fontSize: '11px',
  lineHeight: '11px',
  textAlign: 'center',
  pointerEvents: 'none',
})

/** 고른 줄 — 막대 자리에 흰 둥근 테두리 (0x6aa65, 둥글기 1) */
export const selectedOutline = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.text}`,
  borderRadius: '1px',
  pointerEvents: 'none',
})

/** 진동 OFF/ON 글 */
export const vibrationLabel = style({
  position: 'absolute',
  fontSize: '11px',
  lineHeight: '11px',
  textAlign: 'center',
  pointerEvents: 'none',
})

/** 고른 쪽 노랑 사각 RGB(255,255,85) */
export const vibrationHighlight = style({
  position: 'absolute',
  background: '#FFFF55',
  pointerEvents: 'none',
})
