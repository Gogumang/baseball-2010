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
 * 원작 해상도는 240×320이다. 화면 판은 `zoom: var(--zoom)` 으로 통째로 키운다.
 * 값은 `app/model/useViewportFit` 이 창에 맞춰 적는다 — 데스크톱은 예전대로 정수배 1·2·3, 폰은 꽉 차게
 * (정수배가 충분히 크면 정수배, 아니면 1/80 단위 최대 배율 — `shared/lib/viewportFit`).
 * 아래 값은 그 전(시험 · 첫 틀)의 기본값이다.
 */
globalStyle(':root', {
  colorScheme: 'dark',
  vars: { '--zoom': '1', '--game-height': '100dvh', '--game-track': '1fr' },
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
 * 터치: 두 번 눌러 확대 · 300ms 지연 없게(`manipulation`), 끌어 당겨 새로고침 · 튕김 없게, 길게 눌러 고르기 · 메뉴 없게.
 * 입력칸만 글자를 고를 수 있다.
 */
globalStyle('html', {
  touchAction: 'manipulation',
  overscrollBehavior: 'none',
  WebkitTextSizeAdjust: '100%',
})

globalStyle('body', {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
})

globalStyle('input, textarea', {
  userSelect: 'text',
  WebkitUserSelect: 'text',
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
 * 화면 쪽 `*.css.ts` 도 모두 11px 로 모았다 (원본 본문 글꼴은 하나뿐이라 크기가 여러 가지인 것
 * 자체가 이식하면서 생긴 것이다). **눈에 띄게 커야 하는 자리만 22px** — 정수배가 아니면
 * 다시 뭉갠다. 새 화면을 만들 때도 11 · 22 · 33 말고 다른 값을 쓰지 마라.
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
 * 창 전체를 격자로 나눈다 — 노치·홈 막대(safe-area)를 빼고, 주소창이 오르내리면 `100dvh` 로 따라간다.
 * `body[data-layout]` (`useViewportFit`):
 * - `plain`  — 화면 칸(`#root`) 하나.
 * - `below`  — 세로 폰: 화면 칸(확대한 판 높이 `--game-track`) 위, 터치 버튼 덩이(`pad`) 아래.
 * - `sides`  — 가로 폰: 상황 버튼(`padL`) 왼쪽 · 화면 칸(확대한 판 폭) · 빈 칸(`padR`) 오른쪽.
 */
globalStyle('body', {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100dvh',
  boxSizing: 'border-box',
  padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
  display: 'grid',
  gridTemplateAreas: '"game"',
  gridTemplateRows: 'minmax(0, 1fr)',
  gridTemplateColumns: 'minmax(0, 1fr)',
})

globalStyle('body[data-layout="below"]', {
  gridTemplateAreas: '"game" "pad"',
  gridTemplateRows: 'var(--game-track) minmax(0, 1fr)',
  gridTemplateColumns: 'minmax(0, 1fr)',
})

globalStyle('body[data-layout="sides"]', {
  gridTemplateAreas: '"padL game padR"',
  gridTemplateRows: 'minmax(0, 1fr)',
  gridTemplateColumns: 'minmax(0, 1fr) var(--game-track) minmax(0, 1fr)',
})

/** 터치 버튼 자리는 감싸개 없이 덩이를 격자 칸에 바로 세운다 */
globalStyle('#keypad-root', {
  display: 'contents',
})

/**
 * 화면 한 장을 가운데에 세운다.
 *
 * ⚠️ `position: relative` 가 중요하다 — 화면 **위에 얹히는 덮개**(이벤트 대사창·돌발미션 창 등)는
 * 화면과 형제로 그려지면서 `position: absolute; inset: 0` 을 쓴다. 기준점이 없으면 그 덮개가
 * **창 전체로 퍼져** 초상화·대사가 게임 화면 밖 구석에 나온다. 실제로 그런 상태였다.
 */
globalStyle('#root', {
  gridArea: 'game',
  position: 'relative',
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
})
