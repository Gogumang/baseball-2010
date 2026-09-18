import { style } from '@vanilla-extract/css'

export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const backButton = style({
  position: 'absolute',
  display: 'block',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  imageRendering: 'pixelated',
  selectors: { '&:focus-visible': { outline: '1px dashed #FFFFFF' } },
})
