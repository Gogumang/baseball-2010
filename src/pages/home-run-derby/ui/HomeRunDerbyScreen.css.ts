import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 타석 캔버스(240×320) 와 그 위에 겹치는 HUD·안내 줄의 기준 칸 (미션 화면과 같은 꼴) */
export const stageArea = style({
  position: 'relative',
  flex: 'none',
})

/** 안내·결과 문구는 캔버스 아래쪽에 반투명 띠로 겹친다 */
export const overlay = style({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  background: theme.color.fieldScrim,
  pointerEvents: 'none',
})
