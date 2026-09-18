import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 관리 화면은 원본 240×320 좌표를 그대로 쓴다 — 모든 조각이 절대 배치다 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const board = style([layer, { left: 0, top: 0, width: '240px', height: '320px' }])

export const nameText = style([
  layer,
  {
    height: '20px',
    color: ORIGINAL_COLORS.text,
    fontSize: '11px',
    lineHeight: '20px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
])

export const commandButton = style({
  position: 'absolute',
  width: '32px',
  height: '32px',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  selectors: {
    '&:focus-visible': { outline: '1px dashed #FFFFFF' },
    // 비활성 칸은 흑백으로 바꾼다 (0xc37a8 은 RGB565 채널 평균 — CSS grayscale 은 근사)
    '&:disabled': { filter: 'grayscale(1)', cursor: 'not-allowed' },
  },
})

export const commandIcon = style([layer, { left: '-1px' }])

/** 훈련 연출 팝업 — 원본 좌표 (0, 65) 창을 그대로 덮는다 (TrainingScene 은 좌우 −10px 여백을 가진다) */
export const trainingPopup = style({
  position: 'absolute',
  left: '10px',
  top: 0,
  zIndex: 1,
})


/** 기본정보 카드 판 — 원본 0x7ba44 그리기는 박스만 확인 (추정) */
export const cardPanel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: '1px solid #244CAE',
  background: ORIGINAL_COLORS.panelDeep,
  pointerEvents: 'none',
})

export const infoValue = style([
  layer,
  { fontSize: '11px', lineHeight: '15px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' },
])


