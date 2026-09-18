import { globalStyle, style } from '@vanilla-extract/css'

export const number = style({
  display: 'inline-flex',
  alignItems: 'flex-end',
  gap: '1px',
})

/** 도트 숫자는 원래 크기 그대로. 1.8배 같은 비정수 확대는 픽셀이 깨진다. */
globalStyle(`${number} img`, {
  imageRendering: 'pixelated',
})

export const headingSprite = style({
  display: 'block',
  imageRendering: 'pixelated',
})

export const popupLabel = style({
  display: 'inline-block',
  imageRendering: 'pixelated',
  verticalAlign: 'middle',
})
