import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 장 넘기기 칸 — 원본은 좌우 키(0x637d0)뿐이라 이 단추는 웹판 편의다 */
export const sectionButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  cursor: 'pointer',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
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

/** 본문 창 = 공용 판 0x55e61 (기록연감·환경설정과 같은 가운데 192 판) */
export const panel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

/** 본문 한 줄 — 원본 줄 나누기(`wrapHelpText`)로 이미 나눈 줄이라 웹 글꼴로 다시 접지 않는다 */
export const textLine = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 본문 상자 0xbb28d — 색은 미션 고르기 설명 상자와 같은 근사 */
export const innerBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '2px',
  background: '#213473',
  pointerEvents: 'none',
})

/** 스크롤 막대 바탕 — RGB(32, 48, 158) (0x58c5a) */
export const scrollTrack = style({
  position: 'absolute',
  background: 'rgb(32, 48, 158)',
  pointerEvents: 'none',
})

/** 스크롤 손잡이 — 흰색 폭 4 (0x58cc0 · 0x6a979) */
export const scrollKnob = style({
  position: 'absolute',
  background: 'rgb(255, 255, 255)',
  pointerEvents: 'none',
})

/** 내용 자르기 창 (0xbae25) — 여닫는 동안 판 높이에 맞춰 줄어든다 */
export const clip = style({
  position: 'absolute',
  overflow: 'hidden',
})

/** 등급표 (0x54330) — 바탕과 검정 줄 */
export const ratingTable = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: '1px solid rgb(0, 0, 0)',
  pointerEvents: 'none',
})

export const ratingLine = style({
  position: 'absolute',
  background: 'rgb(0, 0, 0)',
})

export const ratingText = style({
  position: 'absolute',
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
})

/** 쪽 번호 */
export const pagerText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
})

/** 경기 중 [조작방법] — 멈춘 경기 장면을 검정으로 한 번 덮는다 (불투명도는 부르는 쪽이 단계/16 으로 준다) */
export const overGameDim = style({
  position: 'absolute',
  inset: 0,
  background: ORIGINAL_COLORS.black,
})

/** 경기 중 [조작방법] — 240×320 원작 판을 기둥 가운데 둔다 (RawScreen 과 같은 배치, 바탕은 비운다) */
export const overGameCenter = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

export const overGameStage = style({
  position: 'relative',
  flex: 'none',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  overflow: 'hidden',
})
