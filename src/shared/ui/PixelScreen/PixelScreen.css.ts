import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * 피처폰 화면 한 장의 3단 구성 — 타이틀바 · 본문 · 소프트키.
 *
 * 원작 해상도 240×320을 논리 크기로 쓰고, 화면 전체를 정수배로만 확대한다.
 * zoom 안에서 dvh 는 배율을 따르지 않으므로 직접 나눠준다.
 */
export const screen = style({
  display: 'flex',
  flexDirection: 'column',
  width: theme.size.screenWidth,
  height: 'calc(100dvh / var(--zoom))',
  zoom: 'var(--zoom)',
  background: theme.color.field,
  borderLeft: `1px solid ${theme.color.line}`,
  borderRight: `1px solid ${theme.color.line}`,
  overflow: 'hidden',
})

export const titleBar = style({
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '7px 10px',
  background: `linear-gradient(${theme.color.titleBarTop}, ${theme.color.titleBarBottom})`,
  borderBottom: `2px solid ${theme.color.line}`,
  fontSize: '11px',
  fontWeight: 700,
})

export const badge = style({
  fontSize: '11px',
  color: theme.color.badgeInk,
  fontWeight: 400,
})

export const body = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  // 세로 스크롤바가 폭을 잡아먹어 240px 캔버스가 가로로 넘치지 않게 스크롤바는 숨긴다
  overflowX: 'hidden',
  scrollbarWidth: 'none',
  overscrollBehavior: 'contain',
  selectors: { '&::-webkit-scrollbar': { display: 'none' } },
  padding: '0 10px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
})

export const softKeys = style({
  flex: 'none',
  display: 'flex',
  borderTop: `2px solid ${theme.color.line}`,
  background: theme.color.panel,
})

export const softKey = style({
  flex: 1,
  padding: '11px 8px',
  background: 'none',
  border: 'none',
  color: theme.color.accent,
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
  minHeight: '44px',

  selectors: {
    '&:disabled': { color: theme.color.inkFaint, cursor: 'default' },
    // 두 번째 키는 취소 쪽이라 덜 눈에 띄게 둔다
    '& + &': { borderLeft: `2px solid ${theme.color.line}`, color: theme.color.inkDim },
  },
})

/** 본문을 감싸 화살표를 본문 위에 띄운다 */
export const bodyWrapper = style({
  position: 'relative',
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
})

/** 아래에 내용이 더 있을 때만 뜨는 화살표 — 스크롤바를 숨겨서 잘린 것처럼 보이는 것을 막는다 */
export const moreBelow = style({
  position: 'absolute',
  right: '6px',
  bottom: '2px',
  pointerEvents: 'none',
  color: theme.color.accent,
  fontSize: '11px',
  lineHeight: 1,
  textShadow: `0 0 3px ${theme.color.canvas}, 0 0 3px ${theme.color.canvas}`,
})
