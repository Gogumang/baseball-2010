import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 타이틀바·소프트키 없이 원작 240×320 한 장만 쓰는 화면.
 * PixelScreen 과 같은 정수배 확대 규칙을 따른다.
 */
export const screen = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.size.screenWidth,
  // 화면 칸 높이(`--game-height`, `useViewportFit` — 키패드를 뺀 높이)를 배율로 나눈다 — zoom 안의 길이는 배율을 다시 먹는다
  height: 'calc(var(--game-height, 100dvh) / var(--zoom))',
  zoom: 'var(--zoom)',
  background: ORIGINAL_COLORS.black,
  overflow: 'hidden',
})

export const stage = style({
  position: 'relative',
  flex: 'none',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  overflow: 'hidden',
})
