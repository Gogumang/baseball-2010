/**
 * **멈출 수 있는 시계** — 결과 배경 +0x17e2 를 세는 시각. 공용 창이 떠 있는 동안(경기 장면 0x52c50 52cc6 이 갱신 0x4b100 을
 * 건너뜀) 시계가 서고, 창이 닫히면 선 만큼 시작 시각을 뒤로 민다.
 */
export interface FrozenClock {
  /** 시작 시각 (멈춘 만큼 뒤로 밀린 값) */
  readonly startedAt: number
  /** 멈추기 시작한 시각 — 흐르는 중이면 null */
  readonly frozenSince: number | null
}

export function startFrozenClock(now: number): FrozenClock {
  return { startedAt: now, frozenSince: null }
}

/** 이번 그림에서 멈춤 여부를 반영한다 */
export function observeFrozenClock(clock: FrozenClock, now: number, isFrozen: boolean): FrozenClock {
  if (isFrozen) return clock.frozenSince === null ? { ...clock, frozenSince: now } : clock
  if (clock.frozenSince === null) return clock
  return { startedAt: clock.startedAt + (now - clock.frozenSince), frozenSince: null }
}

/** 시계가 가리키는 지금 — 멈춘 동안은 멈춘 시각 */
export function frozenClockNowOf(clock: FrozenClock, now: number): number {
  return clock.frozenSince ?? now
}
