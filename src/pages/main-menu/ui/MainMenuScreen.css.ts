import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/*
 * 배너(mode_back)와 설명 패널(main_ui/003)은 원본 그림이다.
 * 모드 선택은 사용자 요청으로 토스 TDS 의 셀렉트박스 + 바텀시트 방식을 쓴다 (원작은 글자 목록).
 */
const pixel = style({ position: 'absolute', imageRendering: 'pixelated' })

export const banner = style([pixel, { left: 0, top: 0 }])

/** 배너 아래 선택 영역 — 토스 TDS 처럼 셀렉트박스 하나와 주 버튼 하나. */
export const content = style({
  position: 'absolute',
  left: '16px',
  right: '16px',
  top: '96px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

export const backButton = style({
  position: 'absolute',
  left: '6px',
  top: '6px',
  zIndex: 1,
})

export const topRightButtons = style({
  position: 'absolute',
  right: '6px',
  top: '6px',
  zIndex: 1,
  display: 'flex',
  gap: '4px',
})

export const cornerButton = style({ position: 'static' })

export const panel = style([pixel, { left: '45px', top: '251px' }])

export const panelText = style({
  position: 'absolute',
  left: '45px',
  top: '251px',
  width: '149px',
  height: '63px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  color: theme.color.panelRaised,
  // 원본 글꼴 synGak9_11.ft2 가 9×11 이다. 11px 웹 글꼴로는 149px 패널에서 넘친다.
  fontFamily: "'Galmuri9', 'Galmuri11', monospace",
  fontSize: '9px',
  lineHeight: 1.3,
  textAlign: 'center',
})

export const confirmKeys = style({ display: 'flex', gap: '14px', marginTop: '2px' })

globalStyle(`${panelText} p`, { margin: 0 })
