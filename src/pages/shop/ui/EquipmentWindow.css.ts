import { style } from '@vanilla-extract/css'
import { EQUIPMENT_COLORS } from '@/pages/shop/lib/equipmentWindowLayout'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const pixels = style({
  position: 'absolute',
  left: 0,
  top: 0,
  pointerEvents: 'none',
})

/** 숨은 SVG 필터 정의 */
export const hiddenSvg = style({
  position: 'absolute',
  width: 0,
  height: 0,
})

/** 부위 탭 칸을 누르는 투명 단추 — 그림은 프레임이 그린다 */
export const tabButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
})

/** 장비 이름 줄 — 0xba411 정렬 0x22(가운데). 단추로 두어 눌러 고를 수 있게 한다 */
export const rowButton = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  background: 'transparent',
  font: 'inherit',
  fontSize: '11px',
  lineHeight: '13px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  cursor: 'pointer',
})

/** 설명 칸 — 왼쪽 위 정렬, 흰 글 (0xba411 정렬 0x11 · (5, 5)) */
export const description = style({
  position: 'absolute',
  pointerEvents: 'none',
  color: EQUIPMENT_COLORS.descriptionText,
  fontSize: '11px',
  lineHeight: '13px',
  overflow: 'visible',
})

export const descriptionLine = style({
  margin: 0,
  whiteSpace: 'pre',
})
