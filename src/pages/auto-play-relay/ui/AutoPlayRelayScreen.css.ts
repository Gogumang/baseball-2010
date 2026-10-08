import { style } from '@vanilla-extract/css'

/** 원본 노랑 `!cffff00` */
const RELAY_YELLOW = '#ffff00'
/** 반투명 칸 색 0xB4122352 (ARGB — 알파 0xB4, 0x122352) */
const RELAY_BOX = 'rgba(18, 35, 82, 0.706)'

/** "공격팀(%s)" 띠 — 0x6b7d4 네모 칠 (자리 · 크기는 화면이 준다) */
export const offenseBand = style({
  position: 'absolute',
  background: RELAY_BOX,
  pointerEvents: 'none',
})

/** 띠 글 `"!cffff00공격팀(%s)"`(0xd0730) — 0xba269 왼쪽 맞춤 노랑 */
export const offenseText = style({
  position: 'absolute',
  color: RELAY_YELLOW,
  fontSize: '12px',
  lineHeight: '12px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 중계 칸 0xba0bd 둥근 칠 조각 (`roundPlateRectsOf`) */
export const relayPlate = style({
  position: 'absolute',
  background: RELAY_BOX,
  pointerEvents: 'none',
})

/** 중계 글 `"!C!cffff00%s"`(0xd0744) — 칸 폭 안 가운데 노랑 */
export const relayLine = style({
  position: 'absolute',
  textAlign: 'center',
  color: RELAY_YELLOW,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 점수판 0x41c18 자리 — ⚠️ 원본 그림은 미이식이라 웹 글자로 둔다 (자리 · 폭 212 는 원본) */
export const scoreLine = style({
  position: 'absolute',
  width: '212px',
  textAlign: 'center',
  color: '#ffffff',
  fontSize: '12px',
  lineHeight: '14px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})
