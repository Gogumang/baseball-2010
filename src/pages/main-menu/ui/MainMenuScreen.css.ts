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
  // 전역 글꼴(theme.font.body = 원본 synGak9_11 웹폰트)을 그대로 쓴다.
  // 예전에는 Galmuri9 를 9px 로 따로 지정했는데, 그 크기에서는 도트가 정수로 안 떨어져 뭉갠다.
  // 11px 로도 판(149px)에 들어간다 — 가장 긴 줄 "향상 시킬 수 있는 모드입니다"
  // 가 한글 12자(12×10) + 빈칸 4개(4×6) = 144px 다 (한글 9+자간1 · 영문 5+자간1).
  fontSize: '11px',
  lineHeight: 14 / 11,
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
  fontSize: '11px',
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
  fontSize: '11px',
  cursor: 'pointer',
})

globalStyle(`${description} p`, { margin: 0 })
