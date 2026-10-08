import { style } from '@vanilla-extract/css'

/** 원본 노랑 `!cffff00` */
const RELAY_YELLOW = '#ffff00'
/** 반투명 칸 색 0xB4122352 (ARGB — 알파 0xB4, 0x122352) */
const RELAY_BOX = 'rgba(18, 35, 82, 0.706)'

/** "공격팀(%s)" 띠 — 0x6b7d4(…, 높이 18, 색 0xB4122352) 위 `"!cffff00공격팀(%s)"`(0xd0730) */
export const offenseBand = style({
  position: 'absolute',
  left: 0,
  width: '240px',
  height: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  background: RELAY_BOX,
  color: RELAY_YELLOW,
  fontSize: '12px',
  lineHeight: '12px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 중계 글 칸 — 124×18 반투명 칸(0xba0bc, 같은 색)을 (W − 124, …) 에, 글은 `"!C!cffff00%s"`(0xd0744) 가운데 노랑 */
export const relayLine = style({
  position: 'absolute',
  left: '116px',
  width: '124px',
  height: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: RELAY_BOX,
  color: RELAY_YELLOW,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 점수판 0x41c18 자리 — ⚠️ 원본 그림은 미이식이라 웹 글자로 둔다 */
export const scoreLine = style({
  position: 'absolute',
  left: 0,
  top: '10px',
  width: '240px',
  textAlign: 'center',
  color: '#ffffff',
  fontSize: '12px',
  lineHeight: '14px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})
