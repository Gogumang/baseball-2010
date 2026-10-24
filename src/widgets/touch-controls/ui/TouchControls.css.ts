import { globalStyle, style } from '@vanilla-extract/css'
import { UI_COLORS } from '@/shared/config/design'

/** 버튼 높이 — 확인 · 상황 버튼 (터치 칸 권장 44px 이상) */
export const OK_HEIGHT = 64
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
 * 위에서 아래로: 상황 버튼 줄(있을 때만) → 뒤로 · 확인 줄. 칸이 남으면 가운데에 모인다.
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

/** 상황 버튼 줄 — 한 줄로만(작은 폰에서 두 줄이면 확인이 화면 밖으로 밀린다). 많으면 버튼이 좁아진다 */
export const optionRow = style({
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'center',
  gap: GAP,
})

export const mainRow = style({
  display: 'flex',
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

/** 확인 — 가장 자주 누르는 버튼이라 크고 눈에 띄게 */
export const okButton = style([button, {
  flex: '1 1 auto',
  height: OK_HEIGHT,
  fontSize: '24px',
  background: UI_COLORS.accentDeep,
  color: UI_COLORS.inkOnAccent,
  borderColor: UI_COLORS.accent,
  selectors: {
    '&[data-pressed]': { background: UI_COLORS.accent },
  },
}])

/** 뒤로 — 작게, 확인 옆에 */
export const backButton = style([button, {
  flex: '0 0 auto',
  width: 72,
  height: OK_HEIGHT,
  fontSize: '16px',
  color: UI_COLORS.inkDim,
}])

/** 상황 버튼 (필살타 · 마구 · 번트 · 도루 · 교체 · 메뉴) */
export const optionButton = style([button, {
  flex: '0 1 96px',
  minWidth: 0,
  height: OPTION_HEIGHT,
  padding: '0 4px',
  overflow: 'hidden',
  fontSize: '16px',
}])

/** 가로 배치의 확인 — 옆 칸 높이를 넉넉히 쓴다 */
export const tallOk = style({
  height: 'auto',
  minHeight: OK_HEIGHT,
  aspectRatio: '1 / 1',
})

/** 가로 배치는 상황 버튼을 세로로 쌓는다 */
export const optionColumn = style({
  flexDirection: 'column',
  alignItems: 'stretch',
})

globalStyle(`${optionColumn} > button`, {
  flex: '0 0 auto',
})

/** 가로 배치의 뒤로 — 옆 칸 폭을 채운다(상황 버튼과 같은 폭) */
export const wideBack = style({
  flex: '1 1 auto',
  width: 'auto',
})

/**
 * 가로 배치에서 상황 버튼이 많을 때(`SIDES_COLUMN_MAX` 넘게) — 세로 한 줄이면 왼쪽 칸 높이(가로 폰 ≈ 360px)를 넘어 뒤로 버튼이
 * 화면 밖으로 밀린다. 옆 칸은 폭이 남으므로 두 줄 격자로 쌓는다(7개 → 4단 ≈ 216px).
 */
export const optionGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: GAP,
})

/** 세로 배치에서 상황 버튼이 많을 때 — 한 줄은 지키되 글자를 줄여 "1루 견제" 같은 이름이 잘리지 않게 */
export const denseOption = style({
  fontSize: '13px',
  padding: '0 2px',
})
