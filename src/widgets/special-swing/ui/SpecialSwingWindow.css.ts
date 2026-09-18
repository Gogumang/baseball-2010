import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 잠긴 칸 — 원본은 칸 안쪽 1px 만 흑백으로 바꾼다 (0xc37a8). 같은 자리를 잘라 회색 복사본을 덮는다 */
export const lockedRegion = style({
  position: 'absolute',
  overflow: 'hidden',
  filter: 'grayscale(1)',
  pointerEvents: 'none',
})

/** 이름·설명 글 — 원본 문자열표(293/295) 번호 계산이 미해독이라 이름만 넣는다 */
export const text = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 칸을 고를 수 있게 덮는 투명 단추 — 커서 이동용이라 그림은 없다 */
export const slotButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
})
