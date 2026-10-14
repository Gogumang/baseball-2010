import { style } from '@vanilla-extract/css'

/** 타석 캔버스(240×320) 위에 그대로 겹치는 판 — 안쪽은 전부 원본 절대 좌표다 */
export const hud = style({
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

/** 자르기 창 (0x9b901 글꼴 창 · [+0x44] 그림 창) */
export const clip = style({
  position: 'absolute',
  overflow: 'hidden',
})

/** 창 안에서 원본 좌표를 되살리는 판 */
export const unclip = style({
  position: 'absolute',
  width: 240,
  height: 320,
})

/**
 * 목표 글 — "!C%s"(0xcd760) 를 0xba269(글, x, 0x19, 폭 0x4b, −1, 0) 로. 색 −1 은 흰 글(타석 화면 글꼴 색, `skillPanel` 주석).
 * ⚠️ 글꼴은 기기 글꼴이라 11px 로 갈음
 */
export const goalText = style({
  position: 'absolute',
  textAlign: 'center',
  color: '#ffffff',
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
})

/** 효과 0xb(단색) 숫자 — num 0x3c~0x45 (7×12) 꼴에 한 색을 찍는다 */
export const stamp = style({
  position: 'absolute',
  width: 7,
  height: 12,
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
})

/** 쌍점 0x6a9f1 (2×2 칠) */
export const dot = style({
  position: 'absolute',
})
