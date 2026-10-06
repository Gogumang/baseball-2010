import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * 타석 캔버스(240×320) 와 그 위에 겹치는 HUD·안내 줄의 기준 칸.
 *
 * 본문은 좌우 10px 여백이 있고 캔버스는 `margin: 0 -10px` 로 그 여백을 넘어 화면 폭에 붙는다. 이 칸이 여백 안(220px)에
 * 그대로 있으면 겹치는 판(left 0)이 캔버스보다 **10px 오른쪽**에 놓여 원본 좌표가 어긋난다(헤드리스 Chrome 으로 잼:
 * 칸 (10, 220) · 캔버스 (0, 240)). 그래서 칸도 여백만큼 넓히고 안쪽 여백으로 캔버스 자리를 되돌려 둘의 왼쪽·폭을 맞춘다.
 */
export const stageArea = style({
  position: 'relative',
  flex: 'none',
  margin: '0 -10px',
  padding: '0 10px',
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
