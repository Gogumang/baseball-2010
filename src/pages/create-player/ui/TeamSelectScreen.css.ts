import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 팀 고르기도 원작 240×320 좌표를 그대로 쓴다 — 조각마다 절대 배치다 (0x63dee) */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 잠긴 히든 팀 자리의 원 (0x63ec4·0x63ef4) — 지름과 색은 원본 값 그대로다 */
export const lockedCircle = style({
  position: 'absolute',
  borderRadius: '50%',
  pointerEvents: 'none',
})

/** 격자 칸 — 칸 40px 은 확정, 테두리·바탕은 칸 그리기(0x7a571)가 미해독이라 근사다 */
export const cell = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: 0,
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  imageRendering: 'pixelated',
})

export const cellSelected = style({
  borderColor: ORIGINAL_COLORS.highlightYellow,
})

/** 팀 이름·딱지 글자 — 막대 안 가운데 */
export const centeredText = style({
  position: 'absolute',
  textAlign: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '9px',
  lineHeight: '12px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
})
