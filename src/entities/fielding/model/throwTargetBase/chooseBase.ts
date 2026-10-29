import { BASE_POSITIONS, isOutfieldSlot, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { NONE } from '@/entities/fielding/model/fieldingState'
import type { BaseScores } from '@/entities/fielding/model/throwTargetBase/score/scoreBases'
import type { ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase/types'

/**
 * 고르기 시작값 = **500** (b0164: `movs r3,#0xfa ; lsls r3,#1 ; str r3,[sp,#0x1c]`) — 끝의 "아무도 점수를 못 얻었나"
 * 비교도 같은 500 이다 (b02ae: `movs r3,#0xfa ; lsls r3,#1 ; cmp [sp,#0x1c], r3`).
 */
const INITIAL_BEST = 500
/** 1루수 예외가 걸리는 점수 상한 (0xb0290) */
const FIRST_BASEMAN_SCORE_LIMIT = 19_999
const FIRST_BASEMAN_SLOT = 2
/** 아무도 점수를 못 얻었는데 외야수가 잡았으면 던지는 루 */
const OUTFIELD_FALLBACK_BASE = 2

interface Choice {
  readonly best: number
  readonly chosen: number
  readonly topScores: readonly number[]
}

/** (가) 여유가 가장 큰 루 — 하나도 없으면 가장 빠른 수비 루 그대로 */
function chooseWidestMargin(margins: readonly number[], minimumBase: number): Choice {
  let best = NONE
  let chosen = minimumBase
  margins.forEach((margin, base) => {
    if (margin > best && margin >= 0) {
      best = margin
      chosen = base
    }
  })
  return { best, chosen, topScores: [0, 0, 0, 0] }
}

/** 1루수 예외: 포구할 야수가 1루수이고 1루 좌표에 정확히 서 있으며 점수가 전부 낮다 */
function isFirstBasemanException(input: ThrowTargetInput, topScores: readonly number[]): boolean {
  const catchFielder = input.fielders[input.play.catchFielderSlot]
  if (catchFielder === undefined || catchFielder.slot !== FIRST_BASEMAN_SLOT) return false
  return isSamePoint(catchFielder.position, BASE_POSITIONS[1]) && topScores.every((score) => score <= FIRST_BASEMAN_SCORE_LIMIT)
}

/** (나) 점수식. 같은 점수면 뒤 루가 이긴다 (원본의 `최고 ≤ 최고점` 비교) */
function chooseTopScore(input: ThrowTargetInput, scores: BaseScores, minimumBase: number): Choice {
  let best = INITIAL_BEST
  let chosen = minimumBase
  const topScores = [0, 0, 0, 0]
  // 루 × 둘째 루 16칸을 원본 차례(루 바깥 · 둘째 루 안쪽)로 훑는다
  for (let cell = 0; cell < 16; cell += 1) {
    const base = cell >> 2
    const other = cell & 3
    topScores[base] = Math.max(topScores[base], scores.scoreA[base][other] + scores.scoreB[base][other])
    if (best <= topScores[base]) {
      best = topScores[base]
      chosen = base
    }
  }
  return { best, chosen: isFirstBasemanException(input, topScores) ? 1 : chosen, topScores }
}

/** (다) 아무 후보도 점수를 못 얻었으면 — **1루수 예외로 정한 1 도 여기서 뒤집힌다 (원본 그대로)** */
function fallbackBase(input: ThrowTargetInput): number {
  const catchFielder = input.fielders[input.play.catchFielderSlot] ?? input.fielders[input.play.ballHolderSlot]
  return isOutfieldSlot(catchFielder.slot) ? OUTFIELD_FALLBACK_BASE : NONE
}

/** 고르기 (S7 3-4) — 확실한 후보가 있으면 (가), 아니면 (나), 둘 다 못 얻었으면 (다) */
export function chooseBase(input: ThrowTargetInput, scores: BaseScores, minimumBase: number): { chosen: number; topScores: readonly number[] } {
  const choice = scores.sure ? chooseWidestMargin(scores.margins, minimumBase) : chooseTopScore(input, scores, minimumBase)
  const chosen = choice.best === INITIAL_BEST ? fallbackBase(input) : choice.chosen
  return { chosen, topScores: choice.topScores }
}
