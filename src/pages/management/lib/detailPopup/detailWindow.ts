export const DETAIL_WINDOW = { x: 24, y: 45, width: 192, height: 215 }
export const DETAIL_TITLE_FRAME = 372
export const DETAIL_HEADER = { frame: 373, box: { x: 81, y: 72, width: 71, height: 15 } }
export const DETAIL_SLASH_FRAME = 374
export const DETAIL_TABLE_FRAME = 90
/** 표 전체를 −4 만큼 올려 그린다 */
export const DETAIL_Y_OFFSET = -4
export const DETAIL_LABEL_BOX = { x: 42, width: 35, height: 15 }
export const DETAIL_VALUE_BOX = { x: 81, width: 71 }
export const DETAIL_CURRENT_DX = -15
export const DETAIL_MAXIMUM_DX = 18
export const DETAIL_CHANGE_X = 160
export const DETAIL_MESSAGE_BOX = { x: 36, y: 180 + DETAIL_Y_OFFSET, width: 170, height: 70 }
/**
 * 0x872d4(창, dy) 의 둘째 인자 dy 로 표 · 글 상자를 내린다 — 나리 상세 창 0x8a0a4 는 −4(`DETAIL_Y_OFFSET`),
 * 시즌 훈련 결과 창 0xf25c 는 0 이다.
 */
export const detailMessageBoxOf = (yOffset: number = DETAIL_Y_OFFSET) => ({ ...DETAIL_MESSAGE_BOX, y: 180 + yOffset })
export const DETAIL_MESSAGE_LINE_HEIGHT = 16

/** ▲ mode_ui 61 · ▼ 62 */
export const CHANGE_ARROW_FRAMES = { up: 61, down: 62 }

/** i 번째 줄 위 — 0x872d4 의 dy 를 받는다 (나리 −4 · 시즌 훈련 결과 0) */
export const detailRowTopOf = (index: number, yOffset: number) => 76 + 17 * (index + 1) + yOffset
export const DETAIL_ROW_TOP = (index: number) => detailRowTopOf(index, DETAIL_Y_OFFSET)
