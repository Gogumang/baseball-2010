import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS, UI_COLORS } from '@/shared/config/design'

/** 타석 캔버스(240×320) 위에 그대로 겹치는 판 — 안쪽은 전부 절대 좌표다 */
export const hud = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
})

/** 원본 좌표 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
})

/**
 * 공 아이콘 10칸 (0x3608c).
 * 쓴 공은 어둡게, 이번 공은 크게, 아직 안 쓴 공은 그대로, 보너스 게임에서 안 쓰는 칸은 지운다.
 * (원본이 칸을 어떻게 구분해 그리는지는 미확인 — 구분 방식은 웹판이 정했다.)
 */
export const ball = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  selectors: {
    '&[data-state="used"]': { opacity: 0.3 },
    '&[data-state="now"]': { filter: `drop-shadow(0 0 2px ${ORIGINAL_COLORS.highlightYellow})` },
    '&[data-state="off"]': { display: 'none' },
  },
})

/** 최고 기록을 넘었을 때 누적 비거리 줄 뒤에 까는 강조 (원본은 "넘으면 강조" 만 확정) */
export const overBest = style({
  position: 'absolute',
  background: UI_COLORS.accentWash,
  borderRadius: '2px',
})

export const label = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  textShadow: `1px 1px 0 ${ORIGINAL_COLORS.black}`,
})

export const aceName = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.highlightYellow,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  textShadow: `1px 1px 0 ${ORIGINAL_COLORS.black}`,
})
