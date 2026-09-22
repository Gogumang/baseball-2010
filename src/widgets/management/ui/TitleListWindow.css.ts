import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 창 제목 — 원본 제목 그림 프레임을 못 찾아 글자로 적는다 (근사) */
export const header = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 목록 한 줄 — 커서를 올릴 수 있게 투명 단추로 둔다 */
export const row = style({
  position: 'absolute',
  display: 'block',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  font: 'inherit',
  fontSize: '11px',
  lineHeight: '13px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  cursor: 'pointer',
})

/** 지금 장착한 줄 — 원본은 0x19ae8~0x19af6 에서 색만 바꾼다. **어떤 색인지는 미해독이라 노랑으로 둔다 (추정)** */
export const equippedRow = style({
  color: ORIGINAL_COLORS.highlightYellow,
})

/** 커서가 놓인 줄 배경 */
export const cursorRow = style({
  background: ORIGINAL_COLORS.boardHighlight,
})
