import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 192×212 가운데 창 — 바탕 0x55e60(skin, W/2, H/2, 192, 212, …). 판 그림은 근사(단색 판)다 */
export const window = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: '6px 10px',
  background: 'rgba(4, 29, 83, 0.95)',
  border: '1px solid #4A7DF7',
  borderRadius: 2,
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
})

export const title = style({
  textAlign: 'center',
  fontWeight: 'bold',
})

export const name = style({
  textAlign: 'center',
})

export const level = style({
  color: '#FFFF00',
})

export const rows = style({
  display: 'grid',
  gridTemplateColumns: '56px 1fr 16px 1fr',
  rowGap: 2,
})

export const value = style({
  textAlign: 'right',
})

export const arrow = style({
  textAlign: 'center',
})

export const nextValue = style({
  textAlign: 'right',
  color: '#FFFF00',
})

export const cost = style({
  marginTop: 'auto',
})

export const buttons = style({
  display: 'flex',
  justifyContent: 'center',
  gap: 12,
})

export const button = style({
  minWidth: 49,
  height: 23,
  padding: 0,
  border: '1px solid #4A7DF7',
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  font: 'inherit',
  cursor: 'pointer',
})

/** 고른 버튼 — 커서 `skin+0x31e` */
export const buttonSelected = style({
  background: '#FF8C00',
})
