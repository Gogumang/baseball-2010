import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 엔트리 목록 창 0x5cfec → 0x5c984. 판은 공용 판 `CommonPanel`(5ca4e 원본 인자)이고,
 * 줄·칸 그림은 미해독이라 시즌 창들과 같은 방식(둥근 판 + 흰 글)으로 그린다.
 */

const text = {
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
} as const

export const tabLine = style({ ...text, textAlign: 'center', pointerEvents: 'none' })

/**
 * 위 띠(0x12 — #FFFFFF · #E2E2E2) 위 팀 이름 줄. ⚠️ 근사: 원본 띠 안 그림은 아직 안 떴다 — 밝은 띠 위에서 읽히도록
 * img_text 팔레트 3 의 짙은 남색(#10246B)으로 둔다.
 */
export const teamLine = style({ ...text, textAlign: 'center', pointerEvents: 'none', color: '#10246B' })

export const tabActive = style({ color: ORIGINAL_COLORS.highlightYellow })

export const row = style({
  ...text,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
})

/** 커서 줄 */
export const rowCursor = style({ color: ORIGINAL_COLORS.highlightYellow })

/** 첫 번째로 고른 줄 (`+0x418`) */
export const rowPicked = style({ background: ORIGINAL_COLORS.panelDeep })

export const rowAce = style({ color: ORIGINAL_COLORS.cursorCyan })

export const rowNumber = style({ width: '16px', flex: '0 0 16px', textAlign: 'right' })
export const rowName = style({ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis' })
export const rowValue = style({ flex: '0 0 auto' })

export const detail = style({
  ...text,
  boxSizing: 'border-box',
  padding: '2px 4px',
  whiteSpace: 'pre-line',
  background: ORIGINAL_COLORS.panelDeep,
  border: `1px solid ${ORIGINAL_COLORS.boxEdgeOuter}`,
  pointerEvents: 'none',
})

