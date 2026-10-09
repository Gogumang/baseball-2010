import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 원작 240×320 캔버스 자리 — 위에 얹는 판(소개 판 · "CHANGE")이 원본 좌표 그대로 놓이도록 같은 크기 틀이다 */
export const frame = style({
  position: 'relative',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  margin: '0 auto',
})

export const canvas = style({
  display: 'block',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  background: theme.color.stageBackground,
  imageRendering: 'pixelated',
})
