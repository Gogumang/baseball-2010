import { style } from '@vanilla-extract/css'
import { SKILL_WINDOW_COLORS } from '@/widgets/skill-window/lib/skillWindowLayout'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * 그림에 단색을 입힌다 — 원본 효과 11(0xb). 그림을 마스크로 쓰고 배경색을 칠하면 같은 결과다
 * (상점 창·레이더 숫자와 같은 방식).
 */
export const tinted = style({
  position: 'absolute',
  pointerEvents: 'none',
  maskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
})

/** 칸·탭을 고르는 투명 단추 — 그림은 따로 그린다 */
export const hitArea = style({
  position: 'absolute',
  display: 'block',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
})

/** 칸 안 글 — 0xba411(칸, 이름, 정렬 0x22) : 검정 그림자(+1,+1) 뒤 흰 글 */
const cellText = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  lineHeight: '13px',
  whiteSpace: 'nowrap',
  overflow: 'visible',
  pointerEvents: 'none',
})
export const textShadow = style([cellText, { color: SKILL_WINDOW_COLORS.shadow }])
export const textFace = style([cellText, { color: SKILL_WINDOW_COLORS.text }])

/** 설명 박스 4 글 — 정렬 0x11(왼쪽 위), 바탕색 흰 글 */
export const description = style({
  position: 'absolute',
  color: SKILL_WINDOW_COLORS.text,
  pointerEvents: 'none',
  overflow: 'hidden',
})
