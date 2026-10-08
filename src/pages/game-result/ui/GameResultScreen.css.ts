import { style } from '@vanilla-extract/css'

/**
 * 정산 배경(타석 캔버스, 결과 배경) 자리. 타석 캔버스는 PixelScreen 본문 여백을 넘으려 좌우 −10px 를 두므로(`BattingStage.css`)
 * 여백 없는 RawScreen 에서는 10px 밀어 원본 좌표 (0, 0) 에 맞춘다.
 */
export const backdrop = style({
  position: 'absolute',
  left: 10,
  top: 0,
  width: 240,
  height: 320,
  pointerEvents: 'none',
})

/** 원본에 없는 웹 전용 [확인] — 원본은 '0' 이 아닌 키가 정산을 나간다 (0x407f0) */
export const continueButton = style({
  position: 'absolute',
  right: '4px',
  bottom: '4px',
})
