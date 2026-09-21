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

/**
 * 격자 칸 — 칸 40px 은 확정. 바탕·커서 테두리는 이제 원본 그림(slt_frame 0·1)을 쓰므로
 * 여기서는 칠하지 않는다. 그림이 칸(40px)보다 커도 잘리지 않게 넘침을 살려 둔다.
 */
export const cell = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: 0,
  border: 'none',
  background: 'transparent',
  overflow: 'visible',
  cursor: 'pointer',
  imageRendering: 'pixelated',
})

/** 팀 이름·딱지 글자 — 막대 안 가운데 */
export const centeredText = style({
  position: 'absolute',
  textAlign: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
})
