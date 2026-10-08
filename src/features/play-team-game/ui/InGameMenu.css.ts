import { style } from '@vanilla-extract/css'

/**
 * 일시정지 창 0x741a0 뒤 어둡게 — 경기 생성자 0x3301c 가 [창+0x24f] = 1 을 세워 0x746cc 가 **연 그림에 한 번** 검정 단계 5
 * (6/16, `POPUP_DIM_OPACITY`)로 덮는다. 메뉴 동안 경기 장면을 다시 안 그리므로 멈춘 그림 위에 그 한 겹이 남는다.
 * 본문 바깥(`PixelScreen` 의 bodyWrapper, position: relative)을 덮고 메뉴 조각만 그 위로 올린다.
 */
export const dim = style({
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  pointerEvents: 'none',
})

/** 메뉴 조각 — 본문 열 간격(10px)을 그대로 두고 어둡게 위로 올린다 */
export const front = style({
  position: 'relative',
  zIndex: 5,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
})
