import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

/**
 * 투명한 누름 칸 — 그림이 없다. 키보드 초점만 점선으로 보인다.
 * 판 위 겹침(경기 중 메뉴 어둡게 4 · 조각 5 따위)보다 위에 둔다 — 메뉴가 떠 있어도 '*' 자리는 눌려야 한다.
 */
export const pressArea = style({
  position: 'absolute',
  zIndex: SCREEN_LAYERS.PRESS_AREA,
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  selectors: {
    '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` },
    '&:disabled': { cursor: 'default' },
  },
})
