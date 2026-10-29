import { BASE_SCORE } from '@/entities/fielding/model/fieldGeometry'

/** 확실한 아웃 후보의 기본 점수 */
const SURE_OUT_SCORE = 100_000
/** 불확실한 후보의 기본 점수 */
const UNSURE_SCORE = 10_000
/** 홈 보너스 — [불확실, 확실] (+1000000 / +10000000) */
const HOME_BONUS = [1_000_000, 10_000_000] as const
const HOME = 0

/** 한 루 항의 두 점수 — 자리 점수(루 기본 점수 0xd85ac + 홈 보너스) · 확실성 점수 */
export interface TargetTerms {
  readonly place: number
  readonly certainty: number
}

/**
 * 루 하나를 노릴 때의 점수 (S7 3-1 · 3-3 같은 식): 확실한 아웃이면 100000 + 여유, 아니면 10000.
 * 홈이면 자리 점수에 +10000000 / +1000000.
 */
export function targetTermsOf(base: number, sure: boolean, margin: number): TargetTerms {
  const homeBonus = base === HOME ? HOME_BONUS[Number(sure)] : 0
  return {
    place: BASE_SCORE[base] + homeBonus,
    certainty: sure ? SURE_OUT_SCORE + margin : UNSURE_SCORE,
  }
}
