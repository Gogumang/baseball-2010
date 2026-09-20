import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 공용 창 0x55e60 — #335FCD 둥근 판 + #080408 1px 테두리, 안쪽 흰 선 */
export const panel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 미션 이름 — 판 윗부분 제목 띠 위 */
export const title = style({
  position: 'absolute',
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: '11px',
  pointerEvents: 'none',
})

/** 격자 칸 — 칸 그림 내부는 아직 못 읽어 번호와 상태만 그린다 */
export const cell = style({
  position: 'absolute',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '2px',
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
})

/** 고른 칸 — 격자 객체가 그리는 둥근 커서 RGB(48,69,205) (S9) */
export const cursor = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: '1px solid rgb(48, 69, 205)',
  borderRadius: '2px',
  pointerEvents: 'none',
})

/** 설명 상자 0xbb28d */
export const descriptionBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '2px',
  background: '#213473',
  pointerEvents: 'none',
})

export const descriptionText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '10px',
  lineHeight: '12px',
  pointerEvents: 'none',
})

/** 보상·성공 값 — `"!C%dG"` / `"!C%d회"` 흰 가운데 */
export const value = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  fontSize: '10px',
  lineHeight: '10px',
  pointerEvents: 'none',
})

/** 편 바꾸기 · 돌아가기 — 원본은 머리띠 제목과 바닥띠가 하는 일이다 */
export const sideButton = style({
  position: 'absolute',
  left: '4px',
  top: '4px',
})

export const backButton = style({
  position: 'absolute',
  right: '4px',
  top: '4px',
})
