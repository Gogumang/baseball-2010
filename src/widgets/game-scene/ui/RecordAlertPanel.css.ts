import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

/** 240×320 판 — 안쪽은 원본 절대 좌표, 화면 밖으로 나간 줄 막대는 자른다 */
export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 0xba269 글 */
export const text = style({
  position: 'absolute',
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
})

/**
 * 투구 화면(240×320 장면 캔버스가 없는 메뉴식 화면)에서 **화면 기둥 위에** 얹는 자리 — `ScreenOverlay` 와 같은 배율·가운데
 * 규칙이지만 알림은 키·눌림을 안 받으므로 기둥도 눌림을 통과시킨다.
 * 기둥은 판 높이 320 · 세로 가운데다(`ScreenOverlay` r73 과 같다) — 예전에는 창 높이 전체(100dvh)라 알림이 판이 아니라 창 맨 위에 붙었다.
 */
export const screenLayer = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  pointerEvents: 'none',
  zIndex: SCREEN_LAYERS.RECORD_ALERT,
})

export const screenColumn = style({
  position: 'relative',
  flex: 'none',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  zoom: 'var(--zoom)',
  pointerEvents: 'none',
})

/**
 * 240×320 판(RawScreen) **안**에 얹는 자리 — 판이 이미 배율을 먹었으므로 다시 키우지 않는다.
 * 겹은 `RECORD_ALERT` — 장면 창(돌발 창 · 교체 창 따위, 상태 그리기 표 0xd05a0) 위, 팝업 상자(0x746cd) 아래 (0x52c50 53066)
 */
export const stageLayer = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: SCREEN_LAYERS.RECORD_ALERT,
})

/**
 * 경기 중 메뉴(일시정지 창 0x741a0 — 0x746cd 가 알림 **뒤**에 그린다)가 떠 있는 동안의 겹. 메뉴 층(`stageScreen.menuLayer` 6 ·
 * 투수편 `popupLayer` 5)은 '*' 누름 칸(7) 아래여야 해 `RECORD_ALERT` 보다 낮으므로, 그동안은 알림이 메뉴 층 아래로 내려간다.
 * 메뉴와 장면 창(돌발 0x1b~0x1d · 교체 0xb)은 함께 서지 않는다 — '*' 는 0xd~0x15 에서만 메뉴를 연다(4991c)
 */
export const stageLayerUnderMenu = style([stageLayer, { zIndex: 4 }])
