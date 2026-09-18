import { globalStyle, style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

const BOX_WIDTH = 170
const BOX_HEIGHT = 147
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 화면 전체를 덮는다. 상자는 가운데 (추정). */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 20,
  background: ORIGINAL_COLORS.black,
})

export const box = style({
  position: 'absolute',
  left: `${(SCREEN_WIDTH - BOX_WIDTH) / 2}px`,
  top: `${(SCREEN_HEIGHT - BOX_HEIGHT) / 2}px`,
  width: `${BOX_WIDTH}px`,
  height: `${BOX_HEIGHT}px`,
})

export const sprite = style({
  position: 'absolute',
  left: 0,
  top: 0,
  imageRendering: 'pixelated',
})

/** 원본 안쪽 칸 (7,16)~(162,87) — 그림에서 픽셀을 세어 확인했다 */
export const tipArea = style({
  position: 'absolute',
  left: '10px',
  top: '19px',
  width: '150px',
  height: '66px',
  overflow: 'hidden',
  color: ORIGINAL_COLORS.text,
})

globalStyle(`${tipArea} p`, {
  fontSize: '9px',
  lineHeight: 1.45,
})
