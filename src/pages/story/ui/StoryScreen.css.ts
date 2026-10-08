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
 * 배경은 칠하지 않고, 초상화·선택지만 아래쪽에 모은다. say 대사 상자(`EventDialogueBox`)는 화면 좌표로 따로 놓인다.
 * 아래 여백 68 = 대사 상자 띠 위 (H − 55 − 12 − 1) — 초상화 바닥을 상자 위에 둔다.
 * ⚠️ 114 의 초상화 바닥 y 는 미해결이다(A 7절 — 112·113 은 H − 68, 그 밖은 [mgr+0x138] 프레임 사각형 값을 안 떴다).
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

/** 명령 5 화면효과 덮개 — 240×320 칸 전체를 덮고 누르기는 막지 않는다 (효과기 0xbd844 의 (0, 0, 폭, 높이) 칠하기) */
export const effectCover = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 1,
})
