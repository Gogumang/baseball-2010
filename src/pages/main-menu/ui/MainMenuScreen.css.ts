import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/*
 * 메인 메뉴는 원본 그림으로만 그린다 — 배너(mode_back/000), 글자 목록(main_ui/frames),
 * 선택 바(main_ui/002), 설명 판(main_ui/003). 좌표는 `lib/mainMenuLayout.ts` 가 들고 있다.
 * 구석의 스페셜·도움말·환경설정·타이틀 버튼만 원본 화면이 아직 없어 웹 임시로 둔다.
 */
export const layer = style({ position: 'absolute', imageRendering: 'pixelated', pointerEvents: 'none' })

/** 글자 그림 한 줄 — 그림 그대로 두고 눌리는 칸만 만든다 */
export const menuRow = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  imageRendering: 'pixelated',
  selectors: {
    '&:disabled': { cursor: 'default', opacity: 0.45 },
  },
})

/** 설명 판 위에 얹는 글 */
export const description = style({
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  color: theme.color.panelRaised,
  // 원본 글꼴 synGak9_11.ft2 가 9×11 이다. 11px 웹 글꼴로는 149px 판에서 넘친다.
  fontFamily: "'Galmuri9', 'Galmuri11', monospace",
  fontSize: '9px',
  lineHeight: 1.3,
  textAlign: 'center',
  pointerEvents: 'none',
})

export const confirmKeys = style({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: '4px',
  display: 'flex',
  gap: '14px',
  justifyContent: 'center',
  color: theme.color.accent,
  fontSize: '11px',
})

export const backButton = style({
  position: 'absolute',
  left: '6px',
  top: '6px',
  zIndex: 1,
  border: 'none',
  background: 'none',
  color: theme.color.inkDim,
  fontSize: '10px',
  cursor: 'pointer',
})

export const topRightButtons = style({
  position: 'absolute',
  right: '6px',
  top: '6px',
  zIndex: 1,
  display: 'flex',
  gap: '4px',
})

export const cornerButton = style({
  border: 'none',
  background: 'none',
  color: theme.color.inkDim,
  fontSize: '10px',
  cursor: 'pointer',
})

globalStyle(`${description} p`, { margin: 0 })
