import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 엔트리 편집 화면 — 목록 창은 `EntryListWindow` 가 원본 그림으로 그린다. 여기 남은 것은 '0' 상세 창의 근사 글(⚠️ 0x5b798 미이식)뿐이다.
 */
export const detail = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  overflow: 'hidden',
  boxSizing: 'border-box',
  padding: '2px 4px',
  whiteSpace: 'pre-line',
  background: ORIGINAL_COLORS.panelDeep,
  border: `1px solid ${ORIGINAL_COLORS.boxEdgeOuter}`,
  pointerEvents: 'none',
})
