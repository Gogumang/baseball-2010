import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/** 타석 캔버스를 기준으로 알림을 겹치기 위한 틀. */
export const stageArea = style({
  position: 'relative',
})

/**
 * 마선수가 등판했을 때 뜨는 경고 띠.
 * 캔버스 위에 겹친다 — 위에 쌓으면 320px 캔버스가 화면 밖으로 밀린다.
 */
export const aceAlert = style({
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  border: `2px solid ${theme.color.accentDeep}`,
  background: theme.color.alertBackground,
  padding: '6px 9px',
  fontSize: '11px',
})

globalStyle(`${aceAlert} img`, {
  imageRendering: 'pixelated',
  flex: 'none',
})

globalStyle(`${aceAlert} strong`, {
  color: theme.color.accent,
})
