import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 비용 줄 0xba269 — 흰 기본 글, 줄 간격 14 (글꼴 0x6ecd0) */
export const cost = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 원본에 없는 웹 단추 — 그림 자리를 누르면 그 키와 같다 */
export const hitArea = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
})
