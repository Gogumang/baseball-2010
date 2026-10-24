import { style } from '@vanilla-extract/css'
import { UI_COLORS } from '@/shared/config/design'

/** 한 칸 최대 크기 — 넓은 화면에서 키가 지나치게 커지지 않게 */
const KEY_MAX = 72
const GAP = 6
const PAD = 8

/**
 * 키 덩이 하나 (3×4 칸). `body` 격자의 칸(`padL` · `padR`)에 바로 선다 — 감싸개(`#keypad-root`)는 `display: contents`.
 * 칸은 최소 44px (터치 칸 권장 크기), 최대 72px.
 */
export const cluster = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(44px, 1fr))',
  gridTemplateRows: 'repeat(4, minmax(44px, 1fr))',
  gap: GAP,
  padding: PAD,
  width: '100%',
  height: '100%',
  maxWidth: 3 * KEY_MAX + 2 * GAP + 2 * PAD,
  maxHeight: 4 * KEY_MAX + 3 * GAP + 2 * PAD,
  alignSelf: 'center',
  justifySelf: 'center',
  minWidth: 0,
  minHeight: 0,
  // 길게 눌러도 스크롤 · 확대 · 선택 · 메뉴가 안 뜬다
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
})

export const key = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  minHeight: 0,
  padding: 0,
  border: `2px solid ${UI_COLORS.line}`,
  borderRadius: 10,
  background: UI_COLORS.panelRaised,
  color: UI_COLORS.ink,
  font: 'inherit',
  fontSize: '22px',
  lineHeight: 1,
  letterSpacing: 0,
  cursor: 'pointer',
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  selectors: {
    '&[data-pressed]': { background: UI_COLORS.line, borderColor: UI_COLORS.accent },
  },
})

/** OK — 가장 자주 누르는 키라 눈에 띄게 */
export const okKey = style({
  background: UI_COLORS.accentDeep,
  color: UI_COLORS.inkOnAccent,
  borderColor: UI_COLORS.accent,
  selectors: {
    '&[data-pressed]': { background: UI_COLORS.accent },
  },
})

/** CLR — 맨 아랫줄 세 칸을 다 쓴다 */
export const clearKey = style({
  gridColumn: '1 / span 3',
  color: UI_COLORS.inkDim,
})

export const spacer = style({
  pointerEvents: 'none',
})
