import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * 타이틀바·소프트키 없이 원작 240×320 한 장만 쓰는 화면.
 * PixelScreen 과 같은 정수배 확대 규칙을 따른다.
 */
export const screen = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.size.screenWidth,
  height: 'calc(100dvh / var(--zoom))',
  zoom: 'var(--zoom)',
  background: '#000',
  overflow: 'hidden',
})

export const stage = style({
  position: 'relative',
  flex: 'none',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  overflow: 'hidden',
})
