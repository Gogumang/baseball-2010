import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
})

export const item = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '6px',
  width: '100%',
  padding: '9px 8px',
  minHeight: '44px',
  background: 'none',
  border: 'none',
  borderBottom: `1px solid ${theme.color.lineMuted}`,
  color: theme.color.ink,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    'li:last-child &': { borderBottom: 'none' },
    '&[aria-selected="true"]': {
      background: theme.color.panelRaised,
      color: theme.color.accent,
    },
    '&:disabled': { color: theme.color.inkFaint, cursor: 'default' },
  },
})

/**
 * 원본 대사 창의 선택지 목록 (0x7fd22) — 창 본체가 이미 반투명 검정 띠라 테두리·판을 따로 두지 않는다.
 * 줄 사이 간격은 글 그리기의 줄높이 0xe(14) 를 따른다 (R14 3-4).
 */
export const choiceList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
})

/** 고른 줄만 노랑 RGB(255,255,0), 나머지는 흰색 — 배경도 화살표도 없다 */
export const choiceItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '6px',
  width: '100%',
  padding: '0 5px',
  minHeight: '14px',
  lineHeight: '14px',
  background: 'none',
  border: 'none',
  color: ORIGINAL_COLORS.text,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&[aria-selected="true"]': { color: ORIGINAL_COLORS.highlightYellow },
    '&:disabled': { color: theme.color.inkFaint, cursor: 'default' },
  },
})

export const detail = style({
  display: 'block',
  fontSize: '11px',
  color: theme.color.inkDim,
  lineHeight: 1.45,
  selectors: {
    [`${item}[aria-selected="true"] &`]: { color: theme.color.accentMuted },
  },
})

export const cursor = style({
  flex: 'none',
  width: '12px',
  color: theme.color.accent,
})

export const label = style({ flex: 1 })

export const cost = style({
  flex: 'none',
  fontSize: '11px',
  color: theme.color.inkDim,
  paddingTop: '2px',
})

/** 원본 아이콘이 33×33이다. 줄이지 않고 그대로 쓴다. */
export const icon = style({
  flex: 'none',
  width: '33px',
  height: '33px',
  imageRendering: 'pixelated',
})
