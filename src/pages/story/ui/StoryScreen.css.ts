import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * 초상화 판 높이. 가장 큰 인물(event_char_1, 101px)이 들어가는 값.
 * 원작 초상화 바닥 y 는 확정이다(240×320 화면 좌표, R6-sprite-leftovers.md 5절) —
 * 관리 화면은 **y = 135**, 외출 지도·장소는 **y = 252**. 이 이야기 화면 판이 그 좌표 그대로
 * 놓이는지(화면 전체 배치 대조)는 확인하지 않았다.
 */
export const PORTRAIT_HEIGHT = 104

export const nameTag = style({
  alignSelf: 'flex-start',
  marginBottom: '-8px',
  padding: '1px 8px',
  border: `2px solid ${theme.color.line}`,
  borderBottom: 'none',
  background: theme.color.panelRaised,
  color: theme.color.accent,
  fontSize: '11px',
  fontWeight: 700,
})

/**
 * 이벤트는 관리 화면 위에 겹쳐 뜬다 (trigger 0). 240×320 칸 전체를 덮되 뒤 화면이 비치도록
 * 배경은 칠하지 않고, 대사·선택지만 아래쪽에 모은다.
 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'stretch',
  gap: '4px',
  padding: '0 8px 24px',
  zIndex: 30,
})
