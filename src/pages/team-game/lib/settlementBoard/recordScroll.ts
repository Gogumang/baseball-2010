/**
 * 기록 줄 스크롤 — 0x61c55(skin, 0x3a, 4, 개수) · 0x61ce5(skin, 키). 꼴은 기록연감 탭 3 과 같은 스크롤 객체다
 * (`pages/record/lib/annalsGrid` 의 0x61c54 · 0x61ce4 풀이): 길 = 0x3a − 2, 보임 = 4.
 */
export const SETTLEMENT_VISIBLE_ROWS = 4
export const SETTLEMENT_SCROLL_TRACK = 0x3a - 2

export interface SettlementScroll {
  readonly top: number
  readonly total: number
  readonly thumb: number
  readonly step: number
  readonly thumbLength: number
}

export function startSettlementScroll(total: number): SettlementScroll {
  const hidden = total - SETTLEMENT_VISIBLE_ROWS
  if (hidden <= 0) return { top: 0, total, thumb: 0, step: 0, thumbLength: SETTLEMENT_SCROLL_TRACK }
  const step = Math.trunc(SETTLEMENT_SCROLL_TRACK / SETTLEMENT_VISIBLE_ROWS)
  const thumbLength = SETTLEMENT_SCROLL_TRACK - hidden * step
  if (thumbLength >= step) return { top: 0, total, thumb: 0, step, thumbLength }
  return { top: 0, total, thumb: 0, step: 3, thumbLength: SETTLEMENT_SCROLL_TRACK - 3 * hidden }
}

export function scrollSettlementRecords(scroll: SettlementScroll, direction: 'up' | 'down'): SettlementScroll {
  if (scroll.total <= SETTLEMENT_VISIBLE_ROWS) return scroll
  if (direction === 'up') {
    if (scroll.top <= 0) return scroll
    return { ...scroll, top: scroll.top - 1, thumb: Math.max(0, scroll.thumb - scroll.step) }
  }
  if (scroll.top + SETTLEMENT_VISIBLE_ROWS >= scroll.total) return scroll
  return {
    ...scroll,
    top: scroll.top + 1,
    thumb: Math.min(SETTLEMENT_SCROLL_TRACK - 10, scroll.thumb + scroll.step),
  }
}
