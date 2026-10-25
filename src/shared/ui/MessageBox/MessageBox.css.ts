import { globalStyle, style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { theme } from '@/app/styles/theme.css'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

/**
 * 상자 크기 (0x74ef4, F-1 확정):
 * ```
 * h = 줄수×14 + 50 + 행수×버튼높이(15) + (행수−1)×10
 * 상자 y = (320 − h) / 2
 * 버튼 y = 상자y + h − 15 − (행수×15 + (행수−1)×10)
 * ```
 * 한 줄 예/아니오면 **h = 79**, 상자 y = 120, 글 y = 140, 버튼 윗변 y = 169 다.
 * (20 + 14 + 15 + 15 + 15 = 79 — 아래 네 값이 그 구성이다.)
 * 앞서 웹은 버튼 높이를 12 로 보고 h 가 86 이었다.
 */
const TEXT_TOP = 20
const TEXT_TO_BUTTONS = 15
const BUTTONS_TO_BOTTOM = 15
/** 버튼 그림 `ui/popup.pzx` 는 41×15 다 */
const BUTTON_HEIGHT = 15
/** 글 줄 간격 14 (0x74664) */
const LINE_HEIGHT = 14
const FONT_SIZE = 11

/**
 * 상자 뒤 어둡게 — 상자 · 덮개 전체가 이 겹 하나로 선다. 겹 차례는 화면의 누름 칸(7)보다 위인 `SCREEN_LAYERS.POPUP_WINDOW` —
 * 예전 5 에서는 화면에 남은 누름 칸(구질훈련 칸 따위)이 상자 단추를 덮어 클릭 · 탭을 먹었다(r203)
 */
export const dim = style({
  position: 'absolute',
  inset: 0,
  zIndex: SCREEN_LAYERS.POPUP_WINDOW,
  background: theme.color.scrim,
})

/** 판 #335FCD, 위 5줄 #1E1AA6·#1E1AA6·#FFFFFF·#7B9EFF·#7B9EFF, 아래는 거꾸로 (0x744c4) */
const PANEL_BACKGROUND = [
  `linear-gradient(to bottom, ${ORIGINAL_COLORS.boxEdgeOuter} 0 2px, ${ORIGINAL_COLORS.boxEdgeWhite} 2px 3px, ${ORIGINAL_COLORS.boxEdgeInner} 3px 5px, transparent 5px)`,
  `linear-gradient(to top, ${ORIGINAL_COLORS.boxEdgeOuter} 0 2px, ${ORIGINAL_COLORS.boxEdgeWhite} 2px 3px, ${ORIGINAL_COLORS.boxEdgeInner} 3px 5px, transparent 5px)`,
  ORIGINAL_COLORS.boardFill,
].join(', ')

/**
 * 세로 가운데는 **위아래 0 + 위아래 여백 auto** 로 잡는다 — 높이는 내용 높이(`fit-content`)거나 띄운 쪽이 준 값(펼침 · 고정 창).
 * 예전에는 `top: 50%` + `translateY(-50%)` 였다. 판(`RawScreen`)에 CSS `zoom` 이 걸려 있어 백분율 · transform 을 zoom 안에서 다시
 * 계산하는데, 아이폰 Safari 에서 국가대항전 우승 상자가 가운데에 안 선다는 보고가 있었다(r228). 백분율도 transform 도 안 쓰는 길로 바꾼다.
 * 자리를 px 로 주는 창(`top` 을 직접 주는 쪽)은 `bottom: 'auto'` 를 같이 주면 여백 auto 가 0 이 된다(CSS 2.1 §10.6.4).
 * `isolation` 은 예전 transform 이 만들던 쌓임 맥락을 그대로 둔다 — 닫히는 판(z −1)이 상자 안 글 · 버튼 밑에 깔린다.
 */
export const box = style({
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  marginTop: 'auto',
  marginBottom: 'auto',
  height: 'fit-content',
  width: '240px',
  isolation: 'isolate',
  boxSizing: 'border-box',
  padding: `${TEXT_TOP}px 0 ${BUTTONS_TO_BOTTOM}px`,
  background: PANEL_BACKGROUND,
})

/**
 * 닫히는 동안의 판 — 폭 [+0x210] 만 줄고 x = (W − 폭) >> 1 (0x744de~0x74520). 글 · 버튼보다 아래에 그린다
 * (상자의 `isolation` 이 쌓임 맥락을 만들어 z-index −1 이 상자 안 글 · 버튼 밑에 깔린다)
 */
export const closingPanel = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  zIndex: -1,
  background: PANEL_BACKGROUND,
})

/** 글은 (45, 상자y+20) 부터 폭 150 으로 줄바꿈한다 (0x6ef4c · 0x74664) */
export const text = style({
  marginLeft: '45px',
  width: '150px',
  color: ORIGINAL_COLORS.text,
  fontSize: `${FONT_SIZE}px`,
  lineHeight: `${LINE_HEIGHT}px`,
})

// MarkupText 는 이벤트 대사 기준(13px·1.7)이라 상자 규격으로 되돌린다 — 그래야 폭 150 에 한 줄로 들어간다
globalStyle(`${text} p`, { fontSize: `${FONT_SIZE}px`, lineHeight: `${LINE_HEIGHT}px` })

/** 가로 간격 40 ([+0x264]), 가운데 정렬, 글 아래 상자 하단 쪽 (0x74824) */
export const buttons = style({
  display: 'flex',
  justifyContent: 'center',
  gap: '40px',
  marginTop: `${TEXT_TO_BUTTONS}px`,
})

/** 버튼 그림 41×15 — 고른 칸은 49×23 이 같은 기준점에서 사방 4px 넘쳐 나온다 */
const BUTTON_WIDTH = 41

export const button = style({
  position: 'relative',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  fontSize: `${FONT_SIZE}px`,
  width: `${BUTTON_WIDTH}px`,
  height: `${BUTTON_HEIGHT}px`,
  lineHeight: `${BUTTON_HEIGHT}px`,
  cursor: 'pointer',
})

export const buttonImage = style({
  position: 'absolute',
  left: 0,
  top: 0,
  imageRendering: 'pixelated',
})
