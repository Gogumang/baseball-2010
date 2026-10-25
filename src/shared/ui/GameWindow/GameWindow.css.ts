import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

/** 관리 화면 위에 뜨는 창들이 함께 쓰는 스타일 (순위표 0x7f070 · 필살타법 0x803d4) */

/** 창이 열려 있는 동안 화면 전체가 눌림을 받는다 — 아무 데나 누르면 닫힌다 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  cursor: 'pointer',
})

/**
 * 창 안에 공용 상자 0x74ef4(`MessageBox`)가 떠 있는 동안의 덮개 겹 — 덮개(4)가 겹 묶음을 만들어 상자의 `POPUP_WINDOW`(9)가
 * 덮개 안에 갇히면, 화면의 누름 칸(7 — 기본정보 바닥 '*' · '0' 따위)이 상자 위로 새어 나와 누름을 먹는다. 떠 있으면 키는 상자
 * 것이라(0x754f9) 그동안만 덮개째 상자 겹으로 올린다(r207). 늘 올리지는 않는다 — 시즌 다음 경기(`NextGameScreen`)처럼 창 위에
 * 일부러 둔 누름 칸(되돌아가기, r186)이 덮인다
 */
export const overlayWithPopup = style({
  zIndex: SCREEN_LAYERS.POPUP_WINDOW,
})

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * ⚠️ 근사(남김 — 웹 DOM 한계) — 공용 창 0x55e60 의 CSS 흉내다. 원본 선 목록은 `shared/lib/commonPanel` 에서 확정했고
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
