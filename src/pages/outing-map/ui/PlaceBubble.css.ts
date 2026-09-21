import { style } from '@vanilla-extract/css'

/** 말풍선은 지도 위 절대 좌표에 놓인다 (0x7ee1a) */
export const bubble = style({
  position: 'absolute',
  zIndex: 4,
})

/** 칸 글은 가로·세로 가운데 정렬 (0xba411 의 정렬 0x22) */
export const cell = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  font: 'inherit',
  fontSize: '11px',
  lineHeight: '11px',
  cursor: 'pointer',
})
