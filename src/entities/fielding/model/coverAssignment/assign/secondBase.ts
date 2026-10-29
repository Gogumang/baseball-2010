import { basePosition, horizontalDistance, isSamePoint, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState } from '@/entities/fielding/model/fieldingState'
import { isFreeToRetarget } from '@/entities/fielding/model/fielderPose'
import { baseAtPoint, needsCover } from '@/entities/fielding/model/coverAssignment/coverNeed'
import type { CoverAssignmentInput } from '@/entities/fielding/model/coverAssignment/types'

/** 0xd8758 — 타격 지점. 공 시작점이 여기면 타구 판이다 (b1ddc) */
const BATTING_START: WorldPoint = { x: 20_000, y: 1_000, z: 30_000 }
const SECOND_BASEMAN = 3
const SHORTSTOP = 5
const SECOND_BASE = 2

/** 2루 커버와 도움(+0x138) */
export interface KeystonePair {
  readonly cover: number
  readonly helper: number
}

const SHORTSTOP_COVERS: KeystonePair = { cover: SHORTSTOP, helper: SECOND_BASEMAN }
const SECOND_BASEMAN_COVERS: KeystonePair = { cover: SECOND_BASEMAN, helper: SHORTSTOP }
/** b1e12 — 공 가진 야수가 2루수면 유격수가, 유격수면 2루수가 커버 */
const RULE_BY_HOLDER: Readonly<Record<number, KeystonePair>> = { [SECOND_BASEMAN]: SHORTSTOP_COVERS, [SHORTSTOP]: SECOND_BASEMAN_COVERS }

/** b1e12 규칙 — 공 가진 야수, 아니면 공 각(1루 쪽이면 유격수). b1e66: 도움 야수의 발밑 루가 2 면 둘을 맞바꾼다 */
function keystoneByRule(input: CoverAssignmentInput): KeystonePair {
  const { fielders, play } = input.context
  const sideRule = input.ballToFirstSide ? SHORTSTOP_COVERS : SECOND_BASEMAN_COVERS
  const pair = RULE_BY_HOLDER[play.ballHolderSlot] ?? sideRule
  const helperFielder = fielders[pair.helper]
  if (helperFielder === undefined || baseAtPoint(helperFielder.position) !== SECOND_BASE) return pair
  return { cover: pair.helper, helper: pair.cover }
}

/** b1e86 — 2루까지 거리가 먼 쪽이 돕는다: 2루수가 멀면 (커버 5, 도움 3), 아니면 (3, 5) */
function keystoneByDistance(second: FielderState | undefined, short: FielderState | undefined): KeystonePair {
  const point = basePosition(SECOND_BASE)
  const secondFar =
    second !== undefined && short !== undefined && horizontalDistance(second.position, point) > horizontalDistance(short.position, point)
  return secondFar ? SHORTSTOP_COVERS : SECOND_BASEMAN_COVERS
}

/** b1d96~b1dc8 — 막힘 = 2루수 AI 1 || (유격수 AI 1 && !H.vtcc()) */
function isKeystoneBlocked(second: FielderState | undefined, short: FielderState | undefined, holder: FielderState | undefined): boolean {
  if (second?.aiState === AI_STATE.CHASE) return true
  const holderReady = holder === undefined || isFreeToRetarget(holder)
  return short?.aiState === AI_STATE.CHASE && !holderReady
}

/**
 * b1d96~b1f06 — 2루 커버와 도움. 막힘 = 2루수 AI 1 || (유격수 AI 1 && !H.vtcc()) · H = +0x130(b1d0a 의 r5) —
 * vtcc 는 자세 워드까지 본다(r171). 거리 갈래(b1e86)는 "2루 커버가 필요하고 · 안 막혔고 · 공 첫 점이 타격 지점이 아님" 일 때뿐
 * (b1dce~b1e10), 그 밖은 b1e12 규칙.
 */
export function chooseKeystone(input: CoverAssignmentInput, holder: FielderState | undefined): KeystonePair {
  const { context } = input
  const second = context.fielders[SECOND_BASEMAN]
  const short = context.fielders[SHORTSTOP]
  const distanceBranch =
    needsCover(context, SECOND_BASE) && !isKeystoneBlocked(second, short, holder) && !isSamePoint(input.ballStartPoint, BATTING_START)
  return distanceBranch ? keystoneByDistance(second, short) : keystoneByRule(input)
}
