import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 탭 — 눌림만 받고 그림은 막대 프레임이 그린다 */
export const tab = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  cursor: 'pointer',
})

/** 칸 격자 한 칸 — 그림은 프레임이 그리고 글만 얹는다 */
export const cell = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  fontSize: '11px',
  lineHeight: '11px',
  cursor: 'pointer',
})

/** 칸 이름 — 검정 그림자(x, y+7) 위에 흰 글(x−1, y+6) */
export const cellShadow = style({
  position: 'absolute',
  color: '#000000',
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '11px',
  pointerEvents: 'none',
})

export const cellName = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '11px',
  pointerEvents: 'none',
})

export const rowText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 통계 줄 값 `"!R!cffff00…"` — 노랑 오른쪽 맞춤 (0x7a08c) */
export const statValue = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.highlightYellow,
  textAlign: 'right',
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** `"!C!cffff00%d/%d"` — 합계는 노랑 가운데 */
export const totalValue = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.highlightYellow,
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '11px',
  pointerEvents: 'none',
})

/** `"!C!cffffff%d%%"` — 진행도는 흰 가운데 */
export const progressValue = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '11px',
  pointerEvents: 'none',
})

export const descriptionText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  // 줄 높이 = 글꼴 11 + 줄간 3 = 14 (0x6ef4c 의 [sp+0x84] = −1 → 0x9baf1 + 0x9bad9). 네 줄짜리 설명은 원본처럼 상자 밖으로 넘친다
  lineHeight: '14px',
  // 폭 −1 → 날 글 폭이라 자동 줄바꿈이 없다 — `!N` 에서만 끊긴다
  whiteSpace: 'pre',
  pointerEvents: 'none',
})

export const pagerText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  pointerEvents: 'none',
})

/** 판 안 그림 묶음 — 판이 열리고 닫히는 동안 clip-path 로 잘린다 */
export const content = style({
  position: 'absolute',
  inset: 0,
})

/** 탭 0 흐르는 설명 글의 자르기 칸 (x + 2, y, 폭 − 4, 높이) */
export const tickerClip = style({
  position: 'absolute',
  overflow: 'hidden',
  pointerEvents: 'none',
})

export const tickerText = style({
  position: 'absolute',
  top: 0,
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
})

/** 탭 3 스크롤 막대 길 — RGB(0x20, 0x30, 0x9e) (0x58c5a) */
export const scrollTrack = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/** 탭 3 스크롤 막대 — 흰색 (0x58cbe) */
export const scrollThumb = style({
  position: 'absolute',
  background: '#ffffff',
  pointerEvents: 'none',
})
