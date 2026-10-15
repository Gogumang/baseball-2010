import { style } from '@vanilla-extract/css'

export const frame = style({
  position: 'relative',
})

/**
 * 정산 배경(타석 캔버스, 결과 배경) 자리 — 나리 정산(`GameResultScreen.css` 의 `backdrop`)과 같다. 타석 캔버스는 옛 PixelScreen
 * 본문 여백을 넘으려 좌우 −10px 를 두므로(`BattingStage.css`) 여백 없는 RawScreen 에서는 10px 밀어 원본 좌표 (0, 0) 에 맞춘다.
 * 그 위에 정산 판(`SettlementBoard`)이 겹친다.
 */
export const settlementBackdrop = style({
  position: 'absolute',
  left: 10,
  top: 0,
  width: 240,
  height: 320,
  pointerEvents: 'none',
})
