import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 타석 캔버스(240×320) 위에 그대로 겹치는 판 — 안쪽은 전부 원본 절대 좌표다 (`MissionHud` 와 같은 꼴) */
export const band = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 원본 좌표 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
})

/** 0xba269 `!C` 흰 글 — 폭 안 가운데. ⚠️ 글꼴은 기기 글꼴이라 11px 로 갈음 */
export const text = style({
  position: 'absolute',
  textAlign: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
})
