import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 공용 창 0x55e60 — #335FCD 둥근 판 + #080408 1px 테두리 + 안쪽 흰 선.
 * 모양은 선 목록만 확인돼 CSS 로 근사한다 (추정) — 다른 화면들과 같은 근사다.
 */
export const window = style({
  position: 'absolute',
  background: ORIGINAL_COLORS.boardFill,
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.boxEdgeWhite}`,
  borderRadius: '4px',
})

/** 안쪽 칸 0x5eec4 — 색 인자 0x395DCE (R14 1-3) */
export const innerBox = style({
  position: 'absolute',
  background: '#395DCE',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '3px',
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** StrMAINMENU[53] — `0xba269(글, x, y, 162, 흰색)` 가운데 맞춤 */
export const question = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  textAlign: 'center',
  pointerEvents: 'none',
})

/** popup 프레임 1·2(41×15) — 고르면 6·7 로 바뀐다. 테두리 없는 그림 단추다 */
export const answerButton = style({
  position: 'absolute',
  width: '41px',
  height: '15px',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  overflow: 'visible',
})

/**
 * 신기록 알림 — 원본은 그림 대신 **효과음 0x1f**(아니면 0x20)로만 알린다(0x4f644~).
 * 웹은 소리가 없어 글로 대신한다 (원본에 없는 웹판 표시).
 */
export const newRecord = style({
  position: 'absolute',
  left: 0,
  top: '44px',
  width: '240px',
  textAlign: 'center',
  color: ORIGINAL_COLORS.highlightYellow,
  fontSize: '11px',
  lineHeight: '13px',
  textShadow: `1px 1px 0 ${ORIGINAL_COLORS.black}`,
  pointerEvents: 'none',
})
