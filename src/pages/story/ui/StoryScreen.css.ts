import { style } from '@vanilla-extract/css'

/**
 * 초상화 판 높이. 가장 큰 인물(event_char_1, 101px)이 들어가는 값.
 * 원작 초상화 바닥 y 는 확정이다(240×320 화면 좌표, R6-sprite-leftovers.md 5절) —
 * 관리 화면은 **y = 135**, 외출 지도·장소는 **y = 252**. 이 이야기 화면 판이 그 좌표 그대로
 * 놓이는지(화면 전체 배치 대조)는 확인하지 않았다.
 */
export const PORTRAIT_HEIGHT = 104

/**
 * 이벤트는 관리 화면 위에 겹쳐 뜬다 (trigger 0). 240×320 칸 전체를 덮되 뒤 화면이 비치도록
 * 배경은 칠하지 않는다. say 대사 상자(`EventDialogueBox`)와 초상화 판(`portraitLayer`)은 화면 좌표로 따로 놓이고,
 * 선택지 · 알림만 아래 여백 68 = 대사 상자 띠 위 (H − 55 − 12 − 1) 에 모은다.
 * 초상화 바닥 y (0x7fbc4 끝 0x7fdee~0x7fe4c → 0x7f998(창, y), 직접 떴다): 장면 [gfx+0x174] 이 0x70 · 0x71(외출 지도)이거나
 * 0x8b5ac 가 효과 칠 인자를 1 로 넘기면 H − 0x44 = 252, 그 밖은 mode_ui 프레임 10 박스 0 (0, 65, 240, 72) 의
 * y + h − 2 = **135**(관리 화면 위) — `pages/story/lib/eventBackdrop`. 맥락은 app 라우트가 `isOverOutingMap` 으로 넘긴다.
 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'stretch',
  gap: '4px',
  padding: '0 8px 68px',
  zIndex: 30,
})

/** 초상화 판 — 바닥(아래 여백 = H − 바닥 y)은 그릴 때 정한다 */
export const portraitLayer = style({
  position: 'absolute',
  left: 0,
  right: 0,
  pointerEvents: 'none',
})

/** 0x8b5ac 의 화면 칠 0x6a734 ([mgr+0x2c8]) — 밑그림을 덮고 초상화 · 상자 · 창 아래에 깐다 */
export const backdropFill = style({
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  pointerEvents: 'none',
})

/** 명령 5 화면효과 덮개 — 240×320 칸 전체를 덮고 누르기는 막지 않는다 (효과기 0xbd844 의 (0, 0, 폭, 높이) 칠하기) */
export const effectCover = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 1,
})
