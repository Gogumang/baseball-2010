import { BASE_POSITIONS, isOutfieldSlot, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { buildCandidates } from '@/entities/fielding/model/throwTargetBase/candidates/buildCandidates'
import { fillDefenseTicks } from '@/entities/fielding/model/throwTargetBase/candidates/defenseTicks'
import { fillRethrowTicks } from '@/entities/fielding/model/throwTargetBase/candidates/rethrow'
import { chooseBase } from '@/entities/fielding/model/throwTargetBase/chooseBase'
import { scoreBases } from '@/entities/fielding/model/throwTargetBase/score/scoreBases'
import type { ThrowTargetDebug, ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase/types'

const noThrow = (): ThrowTargetDebug => ({
  candidates: [],
  margins: [NONE, NONE, NONE, NONE],
  topScores: [0, 0, 0, 0],
  sure: false,
  chosen: NONE,
})

/** 송구 목표 루. −1 이면 안 던진다 */
export function chooseThrowTargetBase(input: ThrowTargetInput): number {
  return describeThrowTarget(input).chosen
}

/** 점수판까지 함께 돌려준다 — 화면·테스트가 "왜 그 루인가" 를 보여 줄 때 쓴다 */
export function describeThrowTarget(input: ThrowTargetInput): ThrowTargetDebug {
  const holder = input.fielders[input.play.ballHolderSlot]
  // 주자가 없고 내야수가 잡았으면 안 던진다 (0xafb7e)
  if (input.activeRunnerCount === 0 && !isOutfieldSlot(holder.slot)) return noThrow()

  const table = buildCandidates(input)
  const minimumBase = fillDefenseTicks(input, table)
  fillRethrowTicks(input, table)
  // 공 가진 야수가 어느 루 위에도 안 서 있고 투수도 아니다 (3-2 의 "밖")
  const outside = !BASE_POSITIONS.some((point) => isSamePoint(holder.position, point)) && holder.slot !== 0
  const scores = scoreBases(input, table, outside)
  const { chosen, topScores } = chooseBase(input, scores, minimumBase)
  return { candidates: table, margins: scores.margins, topScores, sure: scores.sure, chosen }
}
