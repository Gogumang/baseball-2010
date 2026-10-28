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
    // 'pre' — 줄을 안 접고 끝 빈칸도 가운데 맞춤 폭에 든다(원본 폭 재기 0x9c52c 처럼 — 칭호 "떠오르는 샛별 ", r225)
    whiteSpace: 'pre',
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
    '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` },
    // 비활성 칸의 흑백(0xc37a8)은 `CommandBar` 가 칸 사각형 안 겹마다 회색 그림을 얹는다
    '&:disabled': { cursor: 'not-allowed' },
  },
})

/** 0xc37a8 흑백 사각형 — 칸(32×32) 밖은 자른다 */
export const grayRect = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '32px',
  height: '32px',
  overflow: 'hidden',
  pointerEvents: 'none',
})

export const commandIcon = style([layer, { left: '-1px' }])

/** 훈련 연출 팝업 — 원본 좌표 (0, 65) 창을 그대로 덮는다 (TrainingScene 은 좌우 −10px 여백을 가진다) */
export const trainingPopup = style({
  position: 'absolute',
  left: '10px',
  top: 0,
  zIndex: 1,
})

export const infoValue = style([layer, { fontSize: '11px', lineHeight: '15px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }])

/**
 * 레이더 숫자를 단색으로 찍는다 — 원본 0x5ad94 가 색이 있으면 0x6aff8 에 효과 0xb(단색)를 넘긴다.
 * 그림을 마스크로 쓰고 배경색을 칠하면 같은 결과가 된다 (`pages/shop`·`pages/main-menu` 와 같은 방식).
 */
export const tintedGlyph = style({
  position: 'absolute',
  pointerEvents: 'none',
  maskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
})
