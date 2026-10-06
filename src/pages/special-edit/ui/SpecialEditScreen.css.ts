import { globalStyle, style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { theme } from '@/app/styles/theme.css'

/** 팀 고르기(목록 k 9)도 원작 240×320 좌표 그대로 — 조각마다 절대 배치 (0x63dee) */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const cell = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: 0,
  border: 'none',
  background: 'transparent',
  overflow: 'visible',
  cursor: 'pointer',
  imageRendering: 'pixelated',
})

export const centeredText = style({
  position: 'absolute',
  textAlign: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
})

/** 입력 창 — 팝업 판 위 (MessageBox 와 같은 판 색·테두리 줄 0x744c4) */
export const dim = style({
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  background: theme.color.scrim,
})

export const band = style({
  position: 'absolute',
  left: 0,
  width: '240px',
  boxSizing: 'border-box',
  background: [
    `linear-gradient(to bottom, ${ORIGINAL_COLORS.boxEdgeOuter} 0 2px, ${ORIGINAL_COLORS.boxEdgeWhite} 2px 3px, ${ORIGINAL_COLORS.boxEdgeInner} 3px 5px, transparent 5px)`,
    `linear-gradient(to top, ${ORIGINAL_COLORS.boxEdgeOuter} 0 2px, ${ORIGINAL_COLORS.boxEdgeWhite} 2px 3px, ${ORIGINAL_COLORS.boxEdgeInner} 3px 5px, transparent 5px)`,
    ORIGINAL_COLORS.boardFill,
  ].join(', '),
})

export const prompt = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
})

globalStyle(`${prompt} p`, { fontSize: '11px', lineHeight: '14px', margin: 0 })

/** 입력 칸 바탕 RGB(30,45,160) (0x6b7d5) */
export const field = style({
  position: 'absolute',
  boxSizing: 'border-box',
  margin: 0,
  padding: '0 2px',
  border: 'none',
  outline: 'none',
  background: 'rgb(30, 45, 160)',
  color: '#ffffff',
  fontSize: '11px',
  lineHeight: '15px',
  fontFamily: 'inherit',
})
