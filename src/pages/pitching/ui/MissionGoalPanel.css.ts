import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 장면 240×320 위 HUD 조각 — 누름은 받지 않는다 */
export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  pointerEvents: 'none',
  zIndex: 1,
})

export const image = style({
  position: 'absolute',
  imageRendering: 'pixelated',
})

/** 넘기는 중의 자르기 창 (0x36358 의 rect) */
export const clip = style({
  position: 'absolute',
  overflow: 'hidden',
})

/** `!C%s` — 폭 0x4b 가운데 맞춤 한 줄. ⚠️ 글꼴 · 색은 미확인(흰 11px) */
export const goalText = style({
  position: 'absolute',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  fontSize: '11px',
  lineHeight: '14px',
  color: ORIGINAL_COLORS.text,
})
