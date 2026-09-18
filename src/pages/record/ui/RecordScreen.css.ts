import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'
import { detail } from '@/shared/ui/MenuList/MenuList.css'

export const aceGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px',
})

export const aceCard = style({
  display: 'grid',
  gridTemplateColumns: '40px 1fr',
  gridTemplateRows: 'auto auto',
  alignItems: 'center',
  gap: '0 7px',
  border: `1px solid ${theme.color.line}`,
  background: '#0c1222',
  padding: '5px 6px',
  fontSize: '12px',
})

/** 마선수 그림은 세로로 두 줄을 차지하고 아래쪽에 붙는다. */
globalStyle(`${aceCard} img`, {
  gridRow: '1 / 3',
  width: '40px',
  height: '52px',
  objectFit: 'contain',
  objectPosition: 'bottom',
  imageRendering: 'pixelated',
})

globalStyle(`${aceCard} .${detail}`, {
  fontSize: '10px',
})
