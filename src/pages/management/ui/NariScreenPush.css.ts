import { style } from '@vanilla-extract/css'

/** 밀기 동안 두 화면을 겹쳐 자르는 틀 — 바깥 배치는 안 바꾼다(자식 화면이 제 크기·확대를 정한다) */
export const frame = style({
  position: 'relative',
  overflow: 'hidden',
})

/** 떠 둔 옛 화면 — 새 화면 위에 그린다(0xbd704 가 나중) · 키를 안 받는다 */
export const snapshot = style({
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
})
