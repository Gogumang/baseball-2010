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

/** 엔딩 그림 두 조각이 미끄러지는 칸 — 띠 아래로는 넘치지 않게 자른다 (0xbae25 와 같은 틀) */
export const stageClip = style({
  position: 'absolute',
  left: 0,
  top: 0,
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
