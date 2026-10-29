import { NONE } from '@/entities/fielding/model/fieldingState'
import { adjustForRunners } from '@/entities/fielding/model/throwTargetBase/score/runnerAdjustment'
import { targetTermsOf } from '@/entities/fielding/model/throwTargetBase/score/targetTerms'
import type { BaseCandidate, ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase/types'

/** 점수 바닥값 — 후보가 없어도 0 이 되지 않게 한다 */
const SCORE_FLOOR = 500
/** `인자(아웃 수) + 유효 > 2` 면 "여유가 가장 큰 루" 로 고른다 */
const SURE_OUTS_THRESHOLD = 2

/** 첫 루 항 — 유효(확실한 아웃)면 여유도 함께 */
interface FirstTerms {
  readonly margin: number
  readonly effective: number
  readonly termA: number
  readonly termB: number
}

const isSure = (candidate: BaseCandidate) => candidate.forced || candidate.force

/** 첫 루 항 (3-1 · 3-2) — 주자가 늦게 닿는(여유 ≥ 0) 루만 점수를 얻는다 */
function firstTermsOf(input: ThrowTargetInput, table: readonly BaseCandidate[], base: number, outside: boolean): FirstTerms {
  const candidate = table[base]
  const margin = candidate.runTick - candidate.defTick
  if (margin < 0 || candidate.runTick === 0) return { margin: NONE, effective: 0, termA: 0, termB: 0 }
  const sure = isSure(candidate)
  const terms = targetTermsOf(base, sure, margin)
  const termB = adjustForRunners({ input, candidate, base, outside }, terms.certainty)
  return { margin: sure ? margin : NONE, effective: Number(sure), termA: terms.place, termB }
}

/** 두 번째 루(병살 상대) 항 (3-3) — 유효한 첫 루에서 다시 던져 여유가 남는 루만 */
function secondTermsOf(table: readonly BaseCandidate[], base: number, other: number, effective: number) {
  const candidate = table[base]
  const secondMargin = table[other].runTick - (candidate.defTick + candidate.rethrow[other])
  if (effective !== 1 || other === base || secondMargin <= 0) return { place: 0, certainty: 0 }
  return targetTermsOf(other, isSure(table[other]), secondMargin)
}

export interface BaseScores {
  readonly margins: readonly number[]
  readonly scoreA: readonly (readonly number[])[]
  readonly scoreB: readonly (readonly number[])[]
  readonly sure: boolean
}

/** 루 넷의 (첫 루, 둘째 루) 점수표 — `2×첫 루 항 + 둘째 루 항 + 500` 과 기본 점수 합 (3-1 ~ 3-3) */
export function scoreBases(input: ThrowTargetInput, table: readonly BaseCandidate[], outside: boolean): BaseScores {
  const margins: number[] = []
  const scoreA: number[][] = []
  const scoreB: number[][] = []
  let sure = false
  for (let base = 0; base < 4; base += 1) {
    const first = firstTermsOf(input, table, base, outside)
    margins.push(first.margin)
    const seconds = [0, 1, 2, 3].map((other) => secondTermsOf(table, base, other, first.effective))
    scoreA.push(seconds.map((second) => first.termA + second.place))
    scoreB.push(seconds.map((second) => 2 * first.termB + second.certainty + SCORE_FLOOR))
    if (input.outs + first.effective > SURE_OUTS_THRESHOLD) sure = true
  }
  return { margins, scoreA, scoreB, sure }
}
