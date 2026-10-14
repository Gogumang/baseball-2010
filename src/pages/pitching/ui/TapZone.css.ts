import { style } from '@vanilla-extract/css'

/**
 * 장면 240×320 을 그대로 덮는 누름 칸 판 — 가장 가까운 `position: relative` 장면 판(`RawScreen` 판 · `PitcherSideStage`)에 붙는다.
 * 판 자체는 누름을 받지 않고 칸만 받는다.
 */
export const layer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  pointerEvents: 'none',
  zIndex: 3,
})

/** 투명한 누름 칸 — 그림은 장면이 그린다 */
export const zone = style({
  position: 'absolute',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  color: 'transparent',
  font: 'inherit',
  cursor: 'pointer',
  pointerEvents: 'auto',
  WebkitTapHighlightColor: 'transparent',
  selectors: {
    '&:disabled': { cursor: 'default' },
    '&:focus-visible': { outline: '1px dashed rgba(255, 255, 255, 0.6)' },
  },
})

/** 팝업(경기 중 메뉴 판 zIndex 5)보다 위 — 소프트키는 메뉴가 떠 있어도 '*' 로 닫는다 */
export const layerOnTop = style({
  zIndex: 6,
})
