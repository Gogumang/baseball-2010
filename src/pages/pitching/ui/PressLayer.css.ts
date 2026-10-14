import { globalStyle, style } from '@vanilla-extract/css'

/**
 * 장면 240×320 을 그대로 덮는 누름 칸 판 — 가장 가까운 `position: relative` 장면 판(`RawScreen` 판 · `PitcherSideStage`)에 붙는다.
 * 판 자체는 누름을 받지 않고 그 안의 투명한 누름 칸(`PressArea`)만 받는다.
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

globalStyle(`${layer} > button`, { pointerEvents: 'auto' })

/** 경기 중 메뉴 판(zIndex 5)보다 위 — 소프트키는 메뉴가 떠 있어도 '*' 로 닫는다 */
export const layerOnTop = style({
  zIndex: 6,
})
