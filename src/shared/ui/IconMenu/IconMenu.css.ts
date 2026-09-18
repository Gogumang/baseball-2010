import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 원본 채움 상자가 39px 이라 여섯 칸이 234px — 240 화면에 붙여 놓으면 딱 맞는다. */
export const grid = style({
  display: 'grid',
  justifyContent: 'center',
  gap: 0,
  padding: '6px 0',
})

export const slot = style({
  position: 'relative',
  width: '39px',
  height: '42px',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  selectors: {
    // 노란 테두리가 칸보다 커서 옆 칸에 가린다. 고른 칸만 위로 올린다.
    '&[aria-selected="true"]': { zIndex: 1 },
  },
})

globalStyle(`${slot} img`, {
  position: 'absolute',
  imageRendering: 'pixelated',
})

export const slotBack = style({
  left: 0,
  top: '2px',
})

export const slotIcon = style({
  left: '3px',
  top: '4px',
  selectors: {
    [`${slot}:disabled &`]: { filter: 'grayscale(1) brightness(0.5)' },
  },
})

/** 노란 테두리는 42px 이라 39px 칸보다 크다. 가운데를 맞춰 살짝 넘치게 둔다. */
export const slotFrame = style({
  left: '-1px',
  top: 0,
})

export const caption = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  alignItems: 'center',
  textAlign: 'center',
  border: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
  padding: '7px 8px',
  fontSize: '12px',
})

globalStyle(`${caption} strong`, {
  color: theme.color.accent,
  fontSize: '13px',
})

globalStyle(`${caption} span`, {
  color: theme.color.inkDim,
  fontSize: '11px',
})
