import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 구질 표 — 4행 × 5열 (열 4 는 히든).
 *
 * 글꼴이 11px 이 되면서 영문 한 글자가 6px(5+자간 1)이라 `S.CHANGEUP` 한 칸만 60px 이다.
 * 다섯 칸이면 300px — 240 화면에 어떤 수를 써도 한 줄로는 안 들어간다. 그래서
 *   1. 판 안쪽 여백(10px)을 음수 바깥여백으로 되돌려 표를 **판 폭 끝까지 넓히고**,
 *   2. `minmax(0, 1fr)` 로 칸이 글자 길이에 끌려가지 않게 못박고,
 *   3. 긴 이름은 `overflowWrap: anywhere` 로 **두 줄로 접는다**.
 * 글자를 도로 줄이면 도트가 다시 뭉개지므로 줄을 접는 쪽을 골랐다.
 */
export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: '1px',
  marginInline: '-10px',
})

export const cell = style({
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  padding: '2px 0',
  textAlign: 'center',
  overflowWrap: 'anywhere',
  cursor: 'pointer',
})

/** 이미 배운 구질 — 원본도 고르면 아무 말 없이 무시한다 */
export const cellOwned = style({
  color: ORIGINAL_COLORS.highlightYellow,
  borderColor: ORIGINAL_COLORS.highlightYellow,
})

export const cellLocked = style({
  color: ORIGINAL_COLORS.tableDivider,
})

export const cost = style({
  display: 'block',
  fontSize: '11px',
  color: ORIGINAL_COLORS.tableDivider,
})
