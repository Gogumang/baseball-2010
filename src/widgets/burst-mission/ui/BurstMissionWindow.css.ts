import { globalStyle, style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 돌발미션 창 (경기 장면 상태 0x1b).
 * 창 몸통·안쪽 칸의 그림 모양은 선 목록만 확인돼 CSS 로 근사한다 — 홈런더비 결과 창과 같은 근사다.
 */

/** 창이 떠 있는 동안 화면 전체가 눌림을 받는다 — 아무 데나 누르면 다음으로 넘어간다 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  cursor: 'pointer',
})

/** 공용 창 0x55e60 — #335FCD 둥근 판 + #080408 1px 테두리 + 안쪽 흰 선 (근사) */
export const window = style({
  position: 'absolute',
  background: ORIGINAL_COLORS.boardFill,
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.boxEdgeWhite}`,
  borderRadius: '4px',
})

/** 안쪽 칸 0x5eec4 — 색 인자 0x395DCE (R14 1-3 과 같은 값) */
export const innerBox = style({
  position: 'absolute',
  background: '#395DCE',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '3px',
})

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 결과 문구 — 띠 안 가운데. 색은 마크업(!cffff00)이 입힌다 */
export const headline = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  pointerEvents: 'none',
})

/** 대사 글 — 원본 글 상자와 같은 10px 글·12px 줄 */
export const dialogue = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  pointerEvents: 'none',
})

// MarkupText 는 이벤트 대사 기준(13px·1.7)이라 경기 창 규격으로 되돌린다
globalStyle(`${headline} p, ${dialogue} p`, { fontSize: '11px', lineHeight: '13px' })
