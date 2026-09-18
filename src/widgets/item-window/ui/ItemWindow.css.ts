import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 칸을 고르는 투명 단추 — 그림은 아이콘이 따로 그린다 */
export const slotButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
})

/** 이름칸 — #12307E 판에 어두운 테두리 선 (0x81dc0) */
export const nameBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.nameBoxEdge}`,
  background: ORIGINAL_COLORS.bandDark,
})

/** 이름칸 왼쪽 점 */
export const nameDot = style({
  position: 'absolute',
  width: '1px',
  height: '1px',
  background: ORIGINAL_COLORS.nameBoxDot,
})

export const text = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
})

/** 설명칸 — 여러 줄로 접힌다 */
export const description = style([text, { whiteSpace: 'pre-wrap' }])


/** 이미 산 서브 아이템은 아이콘을 어둡게 해서 구분한다 (원본 표시 방법은 미확인 — 추정) */
export const ownedIcon = style({
  filter: 'brightness(0.45)',
})
