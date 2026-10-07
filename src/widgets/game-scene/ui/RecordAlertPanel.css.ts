import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 240×320 판 — 안쪽은 원본 절대 좌표, 화면 밖으로 나간 줄 막대는 자른다 */
export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 칸 0x5eec5 — 그림은 안 읽어 홈런더비 결과 창 칸과 같은 근사 */
export const box = style({
  position: 'absolute',
  background: '#395DCE',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '3px',
})

/** 0xba269 글 */
export const text = style({
  position: 'absolute',
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
})
