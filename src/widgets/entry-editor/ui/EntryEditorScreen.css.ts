import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 엔트리 목록 창 0x5cfec → 0x5c984 의 근사 모양. 판 자리(15, 55, 210, 220)만 P6 2f 에서 왔고(유력)
 * 줄·칸 그림은 미해독이라 시즌 창들과 같은 방식(둥근 판 + 흰 글)으로 그린다.
 */

export const panel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

const text = {
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
} as const

export const tabLine = style({ ...text, textAlign: 'center', pointerEvents: 'none' })

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

export const hint = style({ ...text, fontSize: '10px', textAlign: 'center', pointerEvents: 'none' })
