import { style } from '@vanilla-extract/css'

/**
 * 강판 뒤 감독 대사 창 (경기 상태 0x23, 그리기 0x50828 → 0x7fbc4 — R14 3-4). 상자 · 글은 `EventDialogueBox` 가 화면 좌표로 그린다.
 * 이 판은 240×320 장면 칸 전체를 덮되 뒤(타석 화면)가 비치도록 칠하지 않는다. 누름은 상자의 누름 칸이 받는다.
 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
})

/** 초상화 판 — 바닥을 H − 0x44 에 둔다(`EventPortraits` 가 원점 발밑을 판 바닥에 맞춘다). 상자(zIndex 30) 다음에 그린다 */
export const portraitLayer = style({
  position: 'absolute',
  zIndex: 31,
  left: 0,
  right: 0,
  pointerEvents: 'none',
})
