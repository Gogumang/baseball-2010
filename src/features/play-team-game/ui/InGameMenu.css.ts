import { style } from '@vanilla-extract/css'

/**
 * 일시정지 창 0x741a0 뒤 어둡게 — 경기 생성자 0x3301c 가 [창+0x24f] = 1 을 세워 0x746cc 가 **연 그림에 한 번** 검정 단계 5
 * (6/16, `POPUP_DIM_OPACITY`)로 덮는다. 메뉴 동안 경기 장면을 다시 안 그리므로 멈춘 그림 위에 그 한 겹이 남는다.
 * 여는 곳의 240×320 층(inset 0)을 덮는다.
 */
export const dim = style({
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  pointerEvents: 'none',
})

/** 메뉴 판 — 240×320 원본 좌표 그대로. 판이 화면 왼쪽 밖에서 밀려 들어오므로 넘친 곳은 자른다 */
export const panel = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  zIndex: 5,
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 원본 그림 한 장 (num) */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 원본 칠 목록 (SVG 네모) */
export const paint = style({
  position: 'absolute',
  pointerEvents: 'none',
})
