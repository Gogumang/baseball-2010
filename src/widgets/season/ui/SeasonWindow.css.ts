import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEXT } from '@/widgets/season/lib/seasonWindowLayout'

/**
 * 시즌모드 창들이 함께 쓰는 스타일.
 * 공용 창 0x55e60 의 판은 원본 선 목록대로 `shared/ui` 의 `CommonPanel` 이 그린다.
 */

const baseText = {
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.size}px`,
  lineHeight: `${TEXT.lineHeight}px`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
} as const

/** 제목 줄 — 가운데 흰 글 */
export const title = style({ ...baseText, textAlign: 'center', pointerEvents: 'none' })

/** 판 안의 설명·알림 글 (줄바꿈 허용) */
export const notice = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  whiteSpace: 'pre-line',
  pointerEvents: 'none',
})

/** 목록 한 줄 — 원본 커서는 고른 줄을 노란 글로 바꾼다 (다른 화면들과 같은 방식) */
export const row = style({
  ...baseText,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:disabled': { cursor: 'default', color: ORIGINAL_COLORS.tableDivider },
  },
})

/** 고른 줄 */
export const rowSelected = style({
  color: ORIGINAL_COLORS.highlightYellow,
})

/** 줄 왼쪽 커서 표시 — ▶ 는 대체 글꼴이 그려 11px 에서 10px 을 먹는다 (8px 이면 1px 삐져나왔다) */
export const cursor = style({
  width: '10px',
  flex: '0 0 10px',
  color: ORIGINAL_COLORS.cursorCyan,
})

/** 줄 이름 */
export const rowLabel = style({ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis' })

/** 줄 오른쪽 값 (가격·수치) */
export const rowValue = style({ flex: '0 0 auto', color: 'inherit' })

/** 판 아래 되돌아가기 — 원본은 바닥띠(0x54d94)의 뒤로 표시가 맡는다 */
export const backButton = style({
  position: 'absolute',
  padding: '1px 4px',
  border: `1px solid ${ORIGINAL_COLORS.boxEdgeInner}`,
  borderRadius: '3px',
  background: ORIGINAL_COLORS.panelDeep,
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  cursor: 'pointer',
})
