import { style } from '@vanilla-extract/css'

/**
 * 타석 캔버스(240×320)와 목표 줄만으로 화면 본문이 꽉 차서, 안내 줄을 캔버스 아래에 두면 반쯤 잘린다 (점검 10차).
 * 안내·결과 문구는 캔버스 아래쪽에 반투명 띠로 겹친다.
 */
export const stageArea = style({
  position: 'relative',
  flex: 'none',
})

export const overlay = style({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(10, 15, 28, 0.72)',
  pointerEvents: 'none',
})
