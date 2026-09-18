import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * 캔버스는 원작 240×320 그대로. 화면 전체가 정수배로 확대된다.
 * 본문 좌우 여백(10px)을 넘어 화면 폭에 꼭 맞춘다 — 테두리를 붙이면 244px 가 되어 가로 스크롤이 생겼다.
 */
export const stage = style({
  display: 'block',
  flex: 'none',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  margin: '0 -10px',
  background: theme.color.stageBackground,
  touchAction: 'none',
  cursor: 'crosshair',
  imageRendering: 'pixelated',
})
