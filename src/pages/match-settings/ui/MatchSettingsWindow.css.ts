import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEXT } from '@/pages/match-settings/lib/matchSettingsLayout'

/**
 * 경기진행 설정 창의 모양.
 *
 * ⚠️ **원본 그리기(0x6042c)는 미해독 — 근사**다. 판은 다른 창들과 같은 공용 판(0x55e60)
 * 모양으로 그리고, 고른 칸은 이 저장소의 관례대로 노란 글·노란 테두리로 표시한다.
 */

/** 공용 판 (24, 54, 192, 212) */
export const window = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

/** 판 위 제목 자리 — 단계 1 에서 종류 이름 그림이 앉는다 */
export const title = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
})

/** 고르는 줄 (종류·이닝 값·찬스 값) */
export const row = style({
  position: 'absolute',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  margin: 0,
  padding: '0 4px',
  border: '1px solid transparent',
  borderRadius: '3px',
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.size}px`,
  lineHeight: `${TEXT.lineHeight}px`,
  textAlign: 'center',
  cursor: 'pointer',
})

/** 커서가 선 줄 */
export const rowSelected = style({
  borderColor: ORIGINAL_COLORS.highlightYellow,
  color: ORIGINAL_COLORS.highlightYellow,
})

/** 이름 그림 (img_text 합성 프레임) */
export const labelImage = style({
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * 찬스 두 칸의 설명 글.
 * ⚠️ 찬스 값에는 이름 그림이 없어(R4 4절 표) 설명을 칸 안에 그대로 그린다.
 */
export const chanceText = style({
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  boxSizing: 'border-box',
  padding: '0 4px',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  pointerEvents: 'none',
})

/** 상세 줄 이름 */
export const detailLabel = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 커서가 선 상세 줄의 이름 */
export const detailLabelSelected = style({
  color: ORIGINAL_COLORS.highlightYellow,
})

/** 상세 칸 — 켜지면 채워진다 */
export const cell = style({
  position: 'absolute',
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
  border: `1px solid ${ORIGINAL_COLORS.boxEdgeOuter}`,
  background: ORIGINAL_COLORS.panelDeep,
  color: ORIGINAL_COLORS.text,
  fontSize: '8px',
  lineHeight: '8px',
  cursor: 'pointer',
})

/** 켜진 칸 */
export const cellOn = style({
  background: ORIGINAL_COLORS.highlightYellow,
  color: ORIGINAL_COLORS.black,
})

/** 커서가 선 칸 */
export const cellFocused = style({
  borderColor: ORIGINAL_COLORS.cursorCyan,
})

/** 판 아래 설명 글 */
export const description = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  pointerEvents: 'none',
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
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  cursor: 'pointer',
})
