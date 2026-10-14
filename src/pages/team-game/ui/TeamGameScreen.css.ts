import { style } from '@vanilla-extract/css'

export const frame = style({
  position: 'relative',
})

/** 정산 판(경기 결과) 자리 — 정산 배경 캔버스 위에 `SettlementBoard` 가 겹친다 */
export const stageArea = style({
  position: 'relative',
})
