import { style } from '@vanilla-extract/css'

/** 타석 캔버스(240×320)를 기준으로 겹침 그림(소개 판 · 알림)을 놓는 틀 */
export const stageArea = style({
  position: 'relative',
  flex: 'none',
})
