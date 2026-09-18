import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

export const STRIKES_FOR_STRIKEOUT = 3
export const BALLS_FOR_WALK = 4

export type PitchResolution =
  | { readonly kind: '스트라이크'; readonly isSwinging: boolean }
  | { readonly kind: '볼' }
  | { readonly kind: '파울' }
  | { readonly kind: '타구'; readonly outcome: AtBatOutcome }

export interface AtBatState {
  readonly balls: number
  readonly strikes: number
  /** 타석이 끝났으면 결과가 들어가고, 진행 중이면 null이다. */
  readonly outcome: AtBatOutcome | null
}

/** 미션은 레코드에 적힌 볼카운트에서 타석을 시작한다 */
export function createAtBat(count: { balls: number; strikes: number } = { balls: 0, strikes: 0 }): AtBatState {
  return { balls: count.balls, strikes: count.strikes, outcome: null }
}

export function isAtBatFinished(state: AtBatState): boolean {
  return state.outcome !== null
}

/** 투구 하나의 결과를 반영한 새 카운트를 돌려준다. 기존 상태는 변경하지 않는다. */
export function applyPitchResolution(
  state: AtBatState,
  resolution: PitchResolution,
): AtBatState {
  if (state.outcome !== null) return state

  switch (resolution.kind) {
    case '스트라이크': {
      const strikes = state.strikes + 1
      return strikes >= STRIKES_FOR_STRIKEOUT
        ? { ...state, strikes, outcome: { kind: '삼진' } }
        : { ...state, strikes }
    }
    case '볼': {
      const balls = state.balls + 1
      return balls >= BALLS_FOR_WALK
        ? { ...state, balls, outcome: { kind: '볼넷' } }
        : { ...state, balls }
    }
    case '파울':
      // 투 스트라이크 이후의 파울은 카운트를 올리지 않는다.
      return state.strikes >= STRIKES_FOR_STRIKEOUT - 1
        ? state
        : { ...state, strikes: state.strikes + 1 }
    case '타구':
      return { ...state, outcome: resolution.outcome }
  }
}
