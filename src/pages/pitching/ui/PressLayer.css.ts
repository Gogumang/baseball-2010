import { globalStyle, style } from '@vanilla-extract/css'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

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

/**
 * 경기 중 메뉴 판보다 위 — 소프트키는 메뉴가 떠 있어도 '*' 로 닫는다. 투수편 메뉴 판은 5 지만 팀경기 · 나리 경기의 메뉴 층
 * (`stageScreen.menuLayer`)은 6 이고 이 판보다 뒤에 그려, 예전 6 이면 같은 겹에서 메뉴 층이 '닫기' 칸을 덮었다(r218 누름 칸 검사).
 * 화면 누름 칸 겹(`PRESS_AREA` 7)으로 둔다 — 메뉴가 띄운 질문 상자(층째 `POPUP_WINDOW` 10)보다는 아래
 */
export const layerOnTop = style({
  zIndex: SCREEN_LAYERS.PRESS_AREA,
})
