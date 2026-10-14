import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 관리 화면 위에 뜨는 창들이 함께 쓰는 스타일 (순위표 0x7f070 · 필살타법 0x803d4) */

/** 창이 열려 있는 동안 화면 전체가 눌림을 받는다 — 아무 데나 누르면 닫힌다 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  cursor: 'pointer',
})

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * ⚠️ 근사 — 공용 창 0x55e60 의 CSS 흉내다. 원본 선 목록은 `shared/lib/commonPanel` 에서 확정했고
 * `shared/ui` 의 `CommonPanel` 이 그대로 그린다. 새 화면은 그것을 쓰고, 이 클래스는 아직 옮기지 않은 화면만 남아 쓴다.
 */
export const window = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})
