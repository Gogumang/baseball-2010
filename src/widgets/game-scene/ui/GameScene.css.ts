import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원본 좌표 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 이름 칸 글 — 원본은 `"!C!cffffff%s"`(0xcf2e0) 가운데 맞춤 흰 글씨다 */
export const pitcherName = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 원본에 없는 웹 전용 확인 단추 — 원본은 소프트키·OK 키가 한다 */
export const okButton = style({
  position: 'absolute',
  right: '4px',
  bottom: '4px',
})

/** 화면을 통째로 덮는 판 (경기 화면 위) */
export const cover = style({
  position: 'absolute',
  inset: 0,
  zIndex: 30,
})
