import { globalFontFace, globalStyle } from '@vanilla-extract/css'
import { PIXEL_FONT_FAMILY, theme } from '@/app/styles/theme.css'

/**
 * 원본 비트맵 글꼴을 구운 웹폰트.
 *
 * `public/font/synGak9.woff2` 는 생성물이다 — 손으로 만들지 말고 다시 구워라:
 *   python3 -m venv tools/.venv && tools/.venv/bin/pip install fonttools brotli
 *   tools/.venv/bin/python tools/build_webfont.py
 *
 * `display: block` 은 글꼴이 늦게 와도 Galmuri 로 한 번 그렸다가 바뀌는 깜빡임을 막는다
 * (28KB 라 같은 서버에서 거의 즉시 온다).
 */
globalFontFace(PIXEL_FONT_FAMILY, {
  src: "url('/font/synGak9.woff2') format('woff2')",
  fontWeight: 'normal',
  fontStyle: 'normal',
  fontDisplay: 'block',
})

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

/**
 * 글자 치수는 원본 "앱 전역 글꼴"(0x6b330, R5 5절) 을 따른다.
 *
 * - `fontSize: 11px` — 조각이 9x11·5x11 이고 웹폰트의 unitsPerEm 이 1100 이라 **11px 에서만
 *   1유닛 100개가 1픽셀에 정확히 떨어진다.** 10px·13px 로 그리면 도트가 뭉개진다.
 * - `letterSpacing: 1px` — 원본 자간. 한글 9+1=10px · 영문 5+1=6px 로 원본 전진과 같다
 *   (CSS 는 마지막 글자 뒤에도 1px 을 붙이는데, 그 한 칸은 **근사다**).
 * - `lineHeight: 14/11` — 원본 줄 높이 11 + 줄간 3 = 14px. 글자 크기를 달리 잡은 화면에서도
 *   비율이 유지되도록 길이가 아니라 숫자로 준다.
 *
 * ⚠️ 화면 쪽 `*.css.ts` 에 `fontSize: 9px|10px|13px` 같은 값이 아직 100곳 넘게 남아 있다.
 * 그 화면들은 도트가 정수배로 떨어지지 않는다 — 11px(또는 22px)로 맞추는 일은 화면마다
 * 따로 해야 해서 여기서는 손대지 않았다.
 */
globalStyle('body', {
  background: theme.color.canvas,
  color: theme.color.ink,
  fontFamily: theme.font.body,
  fontSize: '11px',
  lineHeight: 14 / 11,
  letterSpacing: '1px',
  overflow: 'hidden',
})

/**
 * 화면 한 장을 가운데에 세운다.
 *
 * ⚠️ `position: relative` 가 중요하다 — 화면 **위에 얹히는 덮개**(이벤트 대사창·돌발미션 창 등)는
 * 화면과 형제로 그려지면서 `position: absolute; inset: 0` 을 쓴다. 기준점이 없으면 그 덮개가
 * **창 전체로 퍼져** 초상화·대사가 게임 화면 밖 구석에 나온다. 실제로 그런 상태였다.
 */
globalStyle('#root', {
  position: 'relative',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
})
