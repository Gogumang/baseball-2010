import { globalStyle, style } from '@vanilla-extract/css'
import { UI_COLORS } from '@/shared/config/design'

/** 버튼 높이 — 상황 버튼 (터치 칸 권장 44px 이상) */
export const OPTION_HEIGHT = 48
const GAP = 8
const PAD = 8

const noTouchGestures = {
  // 길게 눌러도 스크롤 · 확대 · 선택 · 메뉴가 안 뜬다
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
} as const

/**
 * 버튼 덩이 하나. `body` 격자의 칸(`pad` · `padL` · `padR`)에 바로 선다 — 감싸개(`#keypad-root`)는 `display: contents`.
 * 상황 버튼 줄(있을 때만). 칸이 남으면 가운데에 모인다.
 */
export const panel = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: GAP,
  padding: PAD,
  width: '100%',
  height: '100%',
  maxWidth: 520,
  alignSelf: 'center',
  justifySelf: 'center',
  minWidth: 0,
  minHeight: 0,
  ...noTouchGestures,
})

/** 상황 버튼 줄 — 넷까지는 한 줄로(많으면 버튼이 좁아진다), 다섯부터는 네 칸 격자(`optionGridFour`) */
export const optionRow = style({
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'center',
  gap: GAP,
})

const button = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  padding: '0 12px',
  border: `2px solid ${UI_COLORS.line}`,
  borderRadius: 12,
  background: UI_COLORS.panelRaised,
  color: UI_COLORS.ink,
  font: 'inherit',
  lineHeight: 1,
  letterSpacing: 0,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  ...noTouchGestures,
  selectors: {
    '&[data-pressed]': { background: UI_COLORS.line, borderColor: UI_COLORS.accent },
  },
})

/** 상황 버튼 (필살타 · 마구 · 번트 · 도루 · 교체 · 메뉴) */
export const optionButton = style([button, {
  flex: '0 1 96px',
  minWidth: 0,
  height: OPTION_HEIGHT,
  padding: '0 4px',
  overflow: 'hidden',
  fontSize: '16px',
}])

/** 가로 배치는 상황 버튼을 세로로 쌓는다 */
export const optionColumn = style({
  flexDirection: 'column',
  alignItems: 'stretch',
})

globalStyle(`${optionColumn} > button`, {
  flex: '0 0 auto',
})

/**
 * 가로 배치에서 상황 버튼이 많을 때(`SIDES_COLUMN_MAX` 넘게) — 세로 한 줄이면 왼쪽 칸 높이(가로 폰 ≈ 360px)를 넘어
 * 화면 밖으로 밀린다. 옆 칸은 폭이 남으므로 두 줄 격자로 쌓는다(7개 → 4단 ≈ 216px).
 */
export const optionGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: GAP,
})

/** 세로 배치에서 상황 버튼이 많을 때(수비 송구 넷 · 주루 일곱 따위) — 한 줄이면 버튼이 손가락보다 좁아져 네 칸 격자로 쌓는다 */
export const optionGridFour = style({
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
})

/** 많은 상황 버튼의 글자 — "1루주자 진루" 같은 이름이 좁은 칸에서 덜 잘리게 */
export const denseOption = style({
  fontSize: '13px',
  padding: '0 2px',
})
