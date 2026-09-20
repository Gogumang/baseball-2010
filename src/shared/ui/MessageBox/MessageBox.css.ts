import { globalStyle, style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { theme } from '@/app/styles/theme.css'

/**
 * 상자 크기 (0x74ef4, F-1 확정):
 * ```
 * h = 줄수×14 + 50 + 행수×버튼높이(15) + (행수−1)×10
 * 상자 y = (320 − h) / 2
 * 버튼 y = 상자y + h − 15 − (행수×15 + (행수−1)×10)
 * ```
 * 한 줄 예/아니오면 **h = 79**, 상자 y = 120, 글 y = 140, 버튼 윗변 y = 169 다.
 * (20 + 14 + 15 + 15 + 15 = 79 — 아래 네 값이 그 구성이다.)
 * 앞서 웹은 버튼 높이를 12 로 보고 h 가 86 이었다.
 */
const TEXT_TOP = 20
const TEXT_TO_BUTTONS = 15
const BUTTONS_TO_BOTTOM = 15
/** 버튼 그림 `ui/popup.pzx` 는 41×15 다 */
const BUTTON_HEIGHT = 15
/** 글 줄 간격 14 (0x74664) */
const LINE_HEIGHT = 14
const FONT_SIZE = 11

export const dim = style({
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  background: theme.color.scrim,
})

/** 판 #335FCD, 위 5줄 #1E1AA6·#1E1AA6·#FFFFFF·#7B9EFF·#7B9EFF, 아래는 거꾸로 (0x744c4) */
export const box = style({
  position: 'absolute',
  left: 0,
  top: '50%',
  width: '240px',
  transform: 'translateY(-50%)',
  boxSizing: 'border-box',
  padding: `${TEXT_TOP}px 0 ${BUTTONS_TO_BOTTOM}px`,
  background: [
    `linear-gradient(to bottom, ${ORIGINAL_COLORS.boxEdgeOuter} 0 2px, ${ORIGINAL_COLORS.boxEdgeWhite} 2px 3px, ${ORIGINAL_COLORS.boxEdgeInner} 3px 5px, transparent 5px)`,
    `linear-gradient(to top, ${ORIGINAL_COLORS.boxEdgeOuter} 0 2px, ${ORIGINAL_COLORS.boxEdgeWhite} 2px 3px, ${ORIGINAL_COLORS.boxEdgeInner} 3px 5px, transparent 5px)`,
    ORIGINAL_COLORS.boardFill,
  ].join(', '),
})

/** 글은 (45, 상자y+20) 부터 폭 150 으로 줄바꿈한다 (0x6ef4c · 0x74664) */
export const text = style({
  marginLeft: '45px',
  width: '150px',
  color: ORIGINAL_COLORS.text,
  fontSize: `${FONT_SIZE}px`,
  lineHeight: `${LINE_HEIGHT}px`,
})

// MarkupText 는 이벤트 대사 기준(13px·1.7)이라 상자 규격으로 되돌린다 — 그래야 폭 150 에 한 줄로 들어간다
globalStyle(`${text} p`, { fontSize: `${FONT_SIZE}px`, lineHeight: `${LINE_HEIGHT}px` })

/** 가로 간격 40 ([+0x264]), 가운데 정렬, 글 아래 상자 하단 쪽 (0x74824) */
export const buttons = style({
  display: 'flex',
  justifyContent: 'center',
  gap: '40px',
  marginTop: `${TEXT_TO_BUTTONS}px`,
})

export const button = style({
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  fontSize: `${FONT_SIZE}px`,
  height: `${BUTTON_HEIGHT}px`,
  lineHeight: `${BUTTON_HEIGHT}px`,
  cursor: 'pointer',
})
