import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

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


/** 상세 설정 지금 값 칸 — 노랑 RGB(255,255,85) 1px 테두리 (0x6a979) */
export const valueOutline = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: '1px solid #FFFF55',
  pointerEvents: 'none',
})
