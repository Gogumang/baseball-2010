import { style } from '@vanilla-extract/css'

/** 조각을 절대 좌표로 찍으므로 글상자는 inline-block + relative 여야 한다 */
export const text = style({
  position: 'relative',
  display: 'inline-block',
  verticalAlign: 'top',
  // 도트 그림이라 비정수 확대는 픽셀이 깨진다
  imageRendering: 'pixelated',
})

/**
 * 조각 하나. 아틀라스 PNG 는 흰 1비트 그림 + 투명 배경이라 그대로 깔면 흰색밖에 안 나온다.
 * 원본은 글꼴 색(+0x54, 기본 흰색 0xFFFF)을 그릴 때 입히므로, 여기서는 아틀라스를 마스크로 쓰고
 * 색은 배경색(= currentColor)으로 넣는다.
 */
export const piece = style({
  position: 'absolute',
  backgroundColor: 'currentColor',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  imageRendering: 'pixelated',
})
