/** 370 "누가 얼마나 잘했는지" — 타이틀 발표 창(0x8b3bc)을 여는 이벤트 */
export const TITLE_INTRO_EVENT_ID = 370
/** 371 + 수상 개수 (0x8b04c) */
export const TITLE_RESULT_BASE_EVENT_ID = 371

export function titleResultEventId(wonCount: number): number {
  return TITLE_RESULT_BASE_EVENT_ID + wonCount
}

/** 수상 개수별 소지금 보상 (100만원 칸) — 371 없음 0 · 372 +3 · 373 +6 · 374 +10 */
const TITLE_REWARD_MONEY_UNITS: readonly number[] = [0, 3, 6, 10]

export function titleRewardMoneyUnitsOf(wonCount: number): number {
  return TITLE_REWARD_MONEY_UNITS[wonCount] ?? 0
}

/** 375 "별 중의 별 MVP 선발만 남았어" — MVP 발표 창(0x8b23c) */
export const MVP_INTRO_EVENT_ID = 375
export const MVP_MISSED_EVENT_ID = 376
export const MVP_EVENT_ID = 377

export function mvpResultEventId(isMostValuablePlayer: boolean): number {
  return isMostValuablePlayer ? MVP_EVENT_ID : MVP_MISSED_EVENT_ID
}
