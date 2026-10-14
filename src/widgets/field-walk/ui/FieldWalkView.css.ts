import { style } from '@vanilla-extract/css'

/** 240×320 원본 화면 — 바탕이 화면 밖으로 넘치므로 자른다 */
export const field = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '240px',
  height: '320px',
  overflow: 'hidden',
  background: '#000',
})

export const background = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 오른쪽 반 — 0x78930 이 같은 그림을 효과 0x11(좌우 뒤집기)로 (x + 폭 − 1) 에 */
export const backgroundMirrored = style([background, { transform: 'scaleX(-1)' }])

/** 선수 한 명의 기준점 — 그림은 원점만큼 옮겨 붙인다 */
export const actor = style({
  position: 'absolute',
  width: 0,
  height: 0,
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 이름표 둥근 칠 한 조각 */
export const block = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/** 이름표 글 — `"!C!cffffff%s"`(0xd09d0) 가운데 맞춤 흰 글씨 (웹 글꼴 근사) */
export const tagText = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ffffff',
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})
