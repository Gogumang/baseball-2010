import { style } from '@vanilla-extract/css'

/** 글은 위의 PixelText 가 찍는다 — 입력 칸은 글자·커서·바탕을 모두 지운 채 키·IME 만 받는다 */
export const input = style({
  position: 'absolute',
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'transparent',
  caretColor: 'transparent',
  font: 'inherit',
  fontSize: '11px',
  outline: 'none',
  selectors: {
    '&::selection': { background: 'transparent' },
  },
})
