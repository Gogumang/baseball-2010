import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 설명 띠 0x55544 — 왼쪽 끝에서 오른쪽으로 펴진다 */
export const band = style({
  position: 'absolute',
  left: 0,
  pointerEvents: 'none',
})

/** 설명 띠 글 — 흰색 (0x1400748(0xff,0xff,0xff)), 줄은 원문 !N 그대로 */
export const text = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})
