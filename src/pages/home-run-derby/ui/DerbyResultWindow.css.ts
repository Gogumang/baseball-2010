import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 타석 캔버스(240×320) 위에 그대로 겹치는 판 — 안쪽은 전부 원본 절대 좌표다 */
export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** StrMAINMENU[53] — `0xba269(글, x, y, 162, 흰색)` 가운데 맞춤 */
export const question = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  textAlign: 'center',
  pointerEvents: 'none',
})

/** popup 프레임 1·2(41×15) — 고르면 6·7 로 바뀐다. 테두리 없는 그림 단추다 */
export const answerButton = style({
  position: 'absolute',
  width: '41px',
  height: '15px',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  overflow: 'visible',
})
