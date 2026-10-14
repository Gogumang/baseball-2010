import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 타석 캔버스(240×320) 위에 그대로 겹치는 판 — 안쪽은 전부 원본 절대 좌표다 */
export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  overflow: 'hidden',
})

export const fill = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
})

export const block = style({
  position: 'absolute',
  pointerEvents: 'none',
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 0xba269 흰 글 */
export const text = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

export const tickerClip = style({
  position: 'absolute',
  overflow: 'hidden',
  pointerEvents: 'none',
})

export const tickerText = style({
  position: 'absolute',
  top: 0,
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
})

/** 스크롤 막대 0x58c10 — 흰 손잡이 */
export const scrollThumb = style({
  position: 'absolute',
  background: '#FFFFFF',
  pointerEvents: 'none',
})

/** 원본에 없는 웹 단추 — 그림 자리를 누르면 그 키와 같다 */
export const hitArea = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
})
