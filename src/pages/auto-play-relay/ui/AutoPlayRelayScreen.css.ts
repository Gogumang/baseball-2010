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

/** 운동장 배경 한 장 (0x78930 — defense.pzx 를 카메라 오프셋에) */
export const fieldBackground = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 오른쪽 반 — 0x78930 이 같은 그림을 효과 0x11(좌우 뒤집기)로 (x + 폭 − 1) 에 */
export const fieldBackgroundMirrored = style([fieldBackground, { transform: 'scaleX(-1)' }])
