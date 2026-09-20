import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 대회 순위표 — 순위표 0x7f070 과 같은 공용 창 0x55e60 이다 */
export const window = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * 확인 키를 받는 투명 칸. 원본은 키(−5/0x35)만 받는데, 웹판은 눌러서도 넘어가게 둔다
 * (⚠️ 원본에 없는 웹 전용 길 — 다른 화면들과 같은 관례다).
 */
export const confirm = style({
  position: 'absolute',
  inset: 0,
  border: 0,
  padding: 0,
  background: 'transparent',
  cursor: 'pointer',
})
