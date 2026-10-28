import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 준비 화면 세 장은 모두 원작 240×320 좌표를 그대로 쓴다 — 조각마다 절대 배치다 (0x63b15) */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 잠긴 칸(히든 팀·잠긴 마선수)의 원 (0x63ec4·0x63ef4) — 지름과 색은 원본 값 그대로다 */
export const lockedCircle = style({
  position: 'absolute',
  borderRadius: '50%',
  pointerEvents: 'none',
})

/** 막대 안 가운데 흰 글 — `"!C!cFFFFFF%s"` (0xd24b4) */
export const centeredText = style({
  position: 'absolute',
  textAlign: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
})

/** `fillRect` 로 그리는 판 (0x5461d · 줄 딱지 둥근 판) */
export const fillPanel = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/**
 * 격자 칸을 누르는 자리 — 그림(남색 둥근 바탕 · slt_frame 이미지 0 · 얼굴 · 커서 이미지 1)은 화면이 원본 자리에 따로 그린다
 * (격자 그리기 0x7a571 종류 7, `prepareLayout` 의 `ACE_LAYOUT.cellBack` 머리말). 이 단추는 테두리·바탕이 없다.
 */
export const cell = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
  imageRendering: 'pixelated',
})
