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
    // 포인터를 올리기만 해서 밝아지던 :hover 는 걷었다 — 원본은 키패드뿐이라 올려 두기로 고른 듯 보이면 안 된다
    '&:focus-visible': { filter: 'brightness(1.3)', outline: 'none' },
  },
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
  fontSize: '11px',
  lineHeight: 14 / 11,
})

/** 밤 덮개 — 화면 전체 [0x15605d4] 단계 9 (0x7eba2). 누름은 아래 건물로 지나간다 */
export const nightCover = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '240px',
  height: '320px',
  background: '#000000',
  pointerEvents: 'none',
})
