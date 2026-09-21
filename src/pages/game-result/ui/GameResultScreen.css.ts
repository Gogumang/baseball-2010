import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원본 좌표 그대로 놓는 그림 한 장 (F-7 · R10 5절) */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 패배면 화면 전체를 검정 단계 8 로 어둡게 (0x4a42a) — 불투명도는 화면 쪽에서 준다 */
export const loseDim = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  background: ORIGINAL_COLORS.black,
  pointerEvents: 'none',
})

/** 띠 fillRect(0, 40, 240, 30, 0x80304EA2) (0x4a466) */
export const band = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/** 이름 칸 글 — 원본은 `"!C!cffffff%s"`(0xcf2e0) 가운데 맞춤 흰 글씨다 */
export const pitcherName = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 보상·기록 줄 (F-7 5) */
export const rewardText = style({
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  textAlign: 'center',
  pointerEvents: 'none',
})

/** 원본 "승리 추가 보상[!cffff00 … G포인트!cffffff]" 의 노란 토막 (0xd060c) */
export const rewardPoint = style({
  color: ORIGINAL_COLORS.highlightYellow,
})

export const detailButton = style({
  position: 'absolute',
  left: '4px',
  top: '4px',
})

export const continueButton = style({
  position: 'absolute',
  right: '4px',
  bottom: '4px',
})
