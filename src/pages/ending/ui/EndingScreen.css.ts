import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 띠 창·아이리스처럼 면과 선만 있는 것은 240×320 SVG 한 장에 그린다 */
export const overlay = style({
  position: 'absolute',
  left: 0,
  top: 0,
  pointerEvents: 'none',
})

/** 띠 창 안 배경(mode_back) 잘라내기 — 0x7b9ad(1, 66, 폭, 70) */
export const bandClip = style({
  position: 'absolute',
  overflow: 'hidden',
})

/** 화면 검정 (0x6a735) */
export const blackScreen = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '240px',
  height: '320px',
  background: '#000000',
  pointerEvents: 'none',
})

/** 제작진 글 잘라내기 — 띠 아래 20px 밑으로만 보인다 (0x88e92~0x88ec8) */
export const creditsClip = style({
  position: 'absolute',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** StrENDING 흰 글 가운데 (0, …, 폭 W) */
export const endingText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
})

/** 제작진 [21] — 아래에서 위로 흐른다 */
export const creditsText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
})

/** 화면 아무 곳이나 눌러 다음으로 — 원작은 OK 키다 */
export const pressArea = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '240px',
  height: '320px',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
})
