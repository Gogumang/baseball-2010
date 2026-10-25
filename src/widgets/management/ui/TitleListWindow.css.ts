import { style } from '@vanilla-extract/css'

/** 이름 칸 — 0xba411 정렬 0x22(가운데). 커서를 올릴 수 있게 투명 단추로 둔다 */
export const row = style({
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
  // 'pre' — 끝 빈칸도 가운데 맞춤 폭에 든다(원문 칭호 "떠오르는 샛별 ", 0x9c52c, r225)
  whiteSpace: 'pre',
  overflow: 'hidden',
  cursor: 'pointer',
})

/** 화면 좌표 그대로의 픽셀 사각형 */
export const pixels = style({
  position: 'absolute',
  left: 0,
  top: 0,
  pointerEvents: 'none',
})

export const hiddenSvg = style({
  position: 'absolute',
  width: 0,
  height: 0,
})
