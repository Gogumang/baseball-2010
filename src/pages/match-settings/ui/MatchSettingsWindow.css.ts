import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { DESCRIPTION_BOX_COLORS, DESCRIPTION_LINE_HEIGHT } from '@/pages/match-settings/lib/matchSettingsLayout'

/**
 * 경기진행 설정 창의 모양.
 *
 * 배치는 그리기 0x6042c 를 떠서 `matchSettingsLayout.ts` 에 옮겼다. 여기는 모양만 둔다.
 * ⚠️ 판(공용 판 0x55e60)의 모양만 근사다 — 공용 판 컴포넌트로 옮기는 중이라 그대로 둔다.
 */

/** 공용 판 0x55e60 — 자리는 단계마다 `SMALL_WINDOW` · `DETAIL_WINDOW` */
export const window = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

/** 그림 한 장 — 원작 좌표에 그대로 놓는다 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 효과 0x11 · 인자 0 — 좌우 뒤집기 */
export const mirrored = style({
  transform: 'scaleX(-1)',
})

/** 숫자 그림 단색 (0x585ac 효과 0xb) — 그림을 마스크로 쓰고 바탕색을 칠한다 */
export const tintedDigit = style({
  position: 'absolute',
  pointerEvents: 'none',
  maskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
})

/** 둥근 테 0x6aa64 의 선 한 토막 */
export const outlineLine = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/** 설명 칸 0xbb28c — 안 칠 · 위·왼 어두운 선 · 아래·오른 밝은 선 (1px) */
export const descriptionBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  background: DESCRIPTION_BOX_COLORS.fill,
  borderTop: `1px solid ${DESCRIPTION_BOX_COLORS.dark}`,
  borderLeft: `1px solid ${DESCRIPTION_BOX_COLORS.dark}`,
  borderBottom: `1px solid ${DESCRIPTION_BOX_COLORS.light}`,
  borderRight: `1px solid ${DESCRIPTION_BOX_COLORS.light}`,
  pointerEvents: 'none',
})

/** 설명 글 한 줄 — 0xba268 (앱 전역 글꼴, 줄 높이 14) */
export const descriptionLine = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: `${DESCRIPTION_LINE_HEIGHT}px`,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 마우스로 고르는 투명 칸 — 그림은 따로 그린다 */
export const hitArea = style({
  position: 'absolute',
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
})

/** 필터 정의만 담는 보이지 않는 svg */
export const hiddenSvg = style({
  position: 'absolute',
  width: 0,
  height: 0,
})

/** 되돌아가기 (웹판 추가 — 원본은 CLR 키다) */
export const backButton = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: '1px 4px',
  border: `1px solid ${ORIGINAL_COLORS.boxEdgeInner}`,
  borderRadius: '3px',
  background: ORIGINAL_COLORS.panelDeep,
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  cursor: 'pointer',
})
