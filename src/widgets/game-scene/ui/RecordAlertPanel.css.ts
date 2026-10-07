import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

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

/** 칸 0x5eec5 — 그림은 안 읽어 홈런더비 결과 창 칸과 같은 근사 */
export const box = style({
  position: 'absolute',
  background: '#395DCE',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '3px',
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
 */
export const screenLayer = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 4,
})

export const screenColumn = style({
  position: 'relative',
  flex: 'none',
  width: 240,
  height: 'calc(100dvh / var(--zoom))',
  zoom: 'var(--zoom)',
  pointerEvents: 'none',
})
