import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 돌발미션 창 (경기 장면 상태 0x1b — 0x8f3c0 · 배치는 `lib/burstMissionWindowLayout`).
 * 타석 화면 위에 덮는다 — 판 밖은 비어 있어 뒤 화면이 그대로 보인다. 상태 0x1b 동안 키는 돌발 창 것이라(0x3b014)
 * 덮개가 눌림을 받아 뒤 타석 화면(스윙 따위)으로 내려보내지 않는다. 겹 차례(z-index)는 화면의 누름 칸보다 위인
 * `SCREEN_LAYERS.SCENE_WINDOW` 를 창이 직접 단다(r195).
 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
})

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 칠한 칸 · 선 (윗 띠 · 본체) */
export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  pointerEvents: 'none',
})

/** 대사 글 — 0xba269 흰 글(앱 글꼴 11px · 줄 14, MarkupText 기본 그대로) */
export const dialogue = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  pointerEvents: 'none',
})
