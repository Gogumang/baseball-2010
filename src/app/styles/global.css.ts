import { globalStyle } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/*
 * 피처폰 시절 화면을 재현한다.
 * 세로 한 화면 안에서 모든 것이 끝나고, 상단 타이틀바 · 본문 · 하단 소프트키의
 * 3단 구성을 지킨다. 모바일에서는 화면을 꽉 채우고 데스크탑에서는 가운데 정렬된다.
 */

/**
 * 원작 해상도는 240×320이다. 도트를 살리려면 화면 전체를 정수배로만 키워야 한다.
 * 어중간한 배율(1.58배 같은)은 픽셀을 불규칙하게 뭉갠다.
 */
globalStyle(':root', {
  colorScheme: 'dark',
  vars: { '--zoom': '1' },
})

/** 화면이 넉넉하면 정확히 2배, 더 넉넉하면 3배로만 키운다. */
globalStyle(':root', {
  '@media': {
    '(min-width: 500px) and (min-height: 660px)': { vars: { '--zoom': '2' } },
    '(min-width: 740px) and (min-height: 980px)': { vars: { '--zoom': '3' } },
  },
})

globalStyle('*', {
  boxSizing: 'border-box',
  WebkitTapHighlightColor: 'transparent',
})

globalStyle('html, body', {
  height: '100%',
  margin: 0,
})

globalStyle('body', {
  background: '#05070d',
  color: theme.color.ink,
  fontFamily: theme.font.body,
  fontSize: '14px',
  lineHeight: 1.55,
  letterSpacing: '0.01em',
  overflow: 'hidden',
})

globalStyle('#root', {
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
})
