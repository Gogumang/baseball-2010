import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 선수 등록은 원작 240×320 좌표를 그대로 쓴다 — 조각마다 절대 배치다 (0x15f34) */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 선수 미리보기 묶음 — 좌타면 발 기준을 축으로 좌우를 뒤집는다 */
export const figure = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
})

/** 정보 칸 값 — 시스템 글꼴 가운데 (0x7c450) */
export const infoValue = style([
  layer,
  { fontSize: '11px', lineHeight: '15px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' },
])

/** 노란 깜빡이 커서 (0x16038) — 값 칸을 사방 1px 키운 테두리 */
export const cursor = style({
  position: 'absolute',
  boxSizing: 'border-box',
  pointerEvents: 'none',
})

/** 값 칸 누름 — 그 줄로 커서를 옮긴다 (원본은 위아래 키로 옮긴다) */
export const valueButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  cursor: 'pointer',
  selectors: {
    '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.highlightYellow}` },
  },
})

/** 고른 줄 양옆 화살표 (그림은 근사) */
export const arrowButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  imageRendering: 'pixelated',
})

export const hint = style([
  layer,
  {
    color: ORIGINAL_COLORS.text,
    fontSize: '11px',
    lineHeight: '13px',
    textAlign: 'center',
  },
])

