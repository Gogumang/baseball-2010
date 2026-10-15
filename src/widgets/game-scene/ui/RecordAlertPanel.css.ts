import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

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
  zIndex: 4,
})

export const screenColumn = style({
  position: 'relative',
  flex: 'none',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  zoom: 'var(--zoom)',
  pointerEvents: 'none',
})

/** 240×320 판(RawScreen) **안**에 얹는 자리 — 판이 이미 배율을 먹었으므로 다시 키우지 않는다 */
export const stageLayer = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 4,
})
