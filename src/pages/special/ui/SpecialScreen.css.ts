import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * 못 쓰는 칸 — 원본에 있는 칸이라 지우지 않고 흐리게만 그린다.
 * (원본에는 이런 상태가 없다. 통신 기능·아직 안 만든 화면을 구분해 보여 주려고 웹판이 더한 것이다.)
 */
export const dimmed = style({
  filter: 'grayscale(1)',
  opacity: 0.4,
})

/** 줄 하나 — 그림은 따로 그리고 눌림만 받는 투명 칸이다 */
export const row = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  cursor: 'pointer',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
})

/** 설명 판 안 글 — RGB(128,128,128) 회색, 11px 줄 */
export const description = style({
  position: 'absolute',
  fontSize: '11px',
  lineHeight: '12px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** 바닥띠 되돌아가기 표시 (바닥 비트 0x4) */
export const backButton = style({
  position: 'absolute',
  display: 'block',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  imageRendering: 'pixelated',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
})

/** 명예의 전당 A 자리의 원 두 개 (0x6b7b9 — A−38 지름 77 · A−31 지름 63) */
export const hofCircle = style({
  position: 'absolute',
  borderRadius: '50%',
  pointerEvents: 'none',
})

/** 이름 막대 안 흰 글씨 가운데 (0xd24b4 `"!C!cFFFFFF%s"`) */
export const hofName = style({
  position: 'absolute',
  textAlign: 'center',
  color: '#FFFFFF',
  fontSize: '11px',
  lineHeight: '11px',
  pointerEvents: 'none',
})

/** 격자 칸 바탕 = 둥근 네모 RGB(48,69,205) (0x7a844). 눌림도 이 칸이 받는다 */
export const hofCell = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  font: 'inherit',
  cursor: 'pointer',
  selectors: {
    '&[aria-current="true"]': { outline: '1px solid #FFFF00' },
    '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` },
  },
})

/** 말풍선 판 76×36 (0x65866) */
export const hofBubble = style({
  position: 'absolute',
  boxSizing: 'border-box',
})

/** 말풍선 칸 70×14 — 흰 글 가운데, 고른 칸은 노랑 테두리 */
export const hofBubbleCell = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  color: '#FFFFFF',
  fontSize: '10px',
  lineHeight: '14px',
  textAlign: 'center',
  cursor: 'pointer',
})
