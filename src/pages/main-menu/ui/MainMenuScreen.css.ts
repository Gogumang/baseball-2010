import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/*
 * 메인 메뉴는 원본 그림으로만 그린다 — 배너(mode_back/000), 글자(main_ui/frames),
 * 선택 바(main_ui/002), 설명 판(main_ui/003), 바퀴 가운데 공(main_ball). 좌표·색은
 * `lib/mainMenuLayout.ts` 가 들고 있다.
 * 윗단(처음 메뉴)은 원본 반원 바퀴, 아랫단(게임시작 목록)은 아직 세로 목록이다(근사).
 * 구석의 취소 버튼만 원본에 없다 — 원본은 CLR 키라 웹 임시로 둔다.
 */
export const layer = style({ position: 'absolute', imageRendering: 'pixelated', pointerEvents: 'none' })

/**
 * 글자 그림 한 칸 — 그림 그대로 두고 눌리는 칸만 만든다.
 * `lineHeight: 0` 은 꾸밈이 아니라 치수 문제다: 인라인 <img> 밑에 붙는 글줄 여백 때문에
 * 버튼이 그림(27px)보다 3px 커져, 27px 간격으로 깔면 줄끼리 겹친 것처럼 잡혔다.
 */
export const menuRow = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  imageRendering: 'pixelated',
  lineHeight: 0,
  fontSize: 0,
})

/**
 * 못 들어가고 안내 문구도 없는 칸(랭킹·게임문의) — 흐리게 둔다.
 * ⚠️ **근사**: 원작이 이런 칸을 어떻게 보이는지는 해독 문서에 없다 (`model/mainMenu.ts` 참고).
 */
export const menuRowDimmed = style([menuRow, { opacity: 0.45 }])

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

globalStyle(`${description} p`, { margin: 0 })
