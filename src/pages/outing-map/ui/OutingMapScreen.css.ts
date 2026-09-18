import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * 외출 지도 — 원본 240×320 화면에 event_map 프레임 0(240×297)을 가운데 정렬로 그린다 (0x7ea64).
 * 세로 가운데 정렬이라 위 여백이 (320 − 297) / 2 = 11 이다 (정렬은 바이트 확인, 화면 높이 320 은 추정).
 */
export const MAP_TOP = 11

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const placeButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  selectors: {
    '&:hover, &:focus-visible': { filter: 'brightness(1.3)', outline: 'none' },
  },
})

export const cornerButton = style({
  position: 'absolute',
  left: '4px',
  top: '4px',
  zIndex: 2,
  padding: '2px 7px',
})

/** 지도 아래 남는 줄에 안내·결과 문구를 쓴다 (원본 메시지줄 위치는 미확인) */
export const noticeLine = style({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 2,
  padding: '1px 4px',
  background: theme.color.scrimOpaque,
  color: theme.color.ink,
  fontSize: '9px',
  lineHeight: 1.4,
})
