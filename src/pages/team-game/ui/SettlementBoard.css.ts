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

/** 공용 창 0x55e60 — 모양은 선 목록만 확인돼 CSS 로 근사한다 (홈런더비 결과 창과 같은 근사) */
export const window = style({
  position: 'absolute',
  background: ORIGINAL_COLORS.boardFill,
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.boxEdgeWhite}`,
  borderRadius: '4px',
  pointerEvents: 'none',
})

/** 칸 0xbb28c(…, 2) — 홈런더비 결과 창의 안쪽 칸과 같은 근사 */
export const innerBox = style({
  position: 'absolute',
  background: '#395DCE',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '3px',
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
