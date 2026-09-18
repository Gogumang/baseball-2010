import { keyframes, style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

const slideUp = keyframes({
  from: { transform: 'translateY(100%)' },
  to: { transform: 'translateY(0)' },
})

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})

/** 가장 가까운 position:relative 조상(화면 한 장)을 덮는다. */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 10,
  background: 'rgba(0, 0, 0, 0.55)',
  animation: `${fadeIn} 160ms ease-out`,
})

export const sheet = style({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 11,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '72%',
  background: theme.color.panel,
  borderTop: `2px solid ${theme.color.line}`,
  borderRadius: '10px 10px 0 0',
  animation: `${slideUp} 200ms ease-out`,
})

/** 끌어내리는 손잡이 모양. 바텀시트라는 걸 한눈에 알려준다. */
export const grabber = style({
  flex: 'none',
  width: '32px',
  height: '4px',
  margin: '6px auto 4px',
  borderRadius: '2px',
  background: theme.color.line,
})

export const title = style({
  flex: 'none',
  margin: 0,
  padding: '2px 14px 8px',
  fontSize: '13px',
  fontWeight: 700,
  color: theme.color.ink,
})

export const body = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  paddingBottom: '6px',
})
