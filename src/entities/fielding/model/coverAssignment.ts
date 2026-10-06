import {
  BASE_DEFAULT_FIELDER,
  basePosition,
  horizontalDistance,
  isSamePoint,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  fielderArrivalTicks,
  isRunnerStopped,
  NONE,
  runnerOneMoreBaseTicks,
  runnerRemainingTicks,
  type DefenseContext,
  type FielderState,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'

/**
 * **루 커버 매 틱 다시 고르기** — 플레이 vt30 = `0xb1c90` 의 커버 부분 (직접 뜬 것).
 *
 * `0xb1c90` 은 매 틱(그리고 송구 0xb2e38 끝 b3094 에서) 돈다. 2루 커버가 아닌 키스톤 야수의 자리 잡기(0xb203a)는
 * `throwArrival.secondBaseHelperPlacement` 이고, 여기는 그 앞뒤의 커버(+0xf0) 정하기다.
 * ```
 * b1c96  어느 야수든 AI 8 이면 끝(이번 틱 +0xf0 은 지난 틱 그대로)
 * b1cd6  +0xf0[0..3] = 표 0xd8774 = [1, 2, 3, 4]
 * b1d0a  H = 공 가진 야수(+0x130) ; k = 0xb1268(H 목표점) = 목표점이 루 k 좌표(0xd86b0)와 같은 k
 * b1d1a  k ≠ −1 && k == +0x130 − 1 && H AI ∉ {1, 9} → 투수 AI 0          ; 제 루에 선 기본 야수 — 넘기기 없음
 * b1d48  아니면 +0x130 == 1 → +0xf0[0] = 0 (투수) · 2 → +0xf0[1] = 0 · 4 → +0xf0[3] = 0
 *          그리고 0xb1b88(그 루) 가 거짓이면 그 칸 = −1
 * b1d96  막힘 = 2루수 AI == 1 || (유격수 AI == 1 && !H.vtcc())
 * b1dca  0xb1b88(2) && !막힘 → b1e12 규칙 / 아니면 공.vt68(0)(공 시작점) == 0xd8758(20000,1000,30000) 이면 b1e12 규칙,
 *        아니면 b1e86: 2루(0xd86c8)까지 거리가 먼 쪽이 돕는다 — 2루수가 멀면 (커버 5, 도움 3), 아니면 (3, 5)
 * b1e12  +0x130 == 3 → (커버 5, 도움 3) · == 5 → (3, 5) · 아니면 공 각 + 90 > 0 ? (5, 3) : (3, 5)
 * b1e66    도움 야수의 발밑 루(vt58 = 0xa0ae4)가 2 면 둘을 맞바꾼다
 * b1f06  +0xf0[2] = 커버 ; +0x138 = 도움 → (0xb203a 자리 잡기)
 * b23a4  b = H.vt68()(목표점이 루 b) ≠ −1 && H AI ≠ 9 → +0xf0[b] = H
 * b23dc  루 j 마다 c = +0xf0[j] ≠ −1, d = 0xd8774[j]:
 *          c == d → 투수.vt68() == j 일 때만 대신 S = 투수 · +0xf0[j] = 0, 아니면 다음 루
 *          c ≠ d → S = c
 *          S.vt18()(목표점에 있음) && d AI == 0 이고, 주자 하나라도 "d 가 먼저 닿는다"(아래)면
 *          S AI ≠ 8 이면 S AI 0 · +0xf0[j] = d
 * b2440  주자 R 마다: nb = 0xb6228(R) = R+0x8c ≤ 3 ? R+0x8c + 1 : R+0x8c
 *          nb == j: R 아웃이면 건너뜀 ; R.vt18() 면 R.vt1c(루 j 좌표) > d.vtc0() · 아니면 0xbefec(R) > d.vtc0()
 *          nb ≠ j: R+0x7c == (j + 3) & 3 이면 R.vta0() > d.vtc0()
 * b2564  루 j 마다 c = +0xf0[j] ≠ −1 이고 c AI ∉ {8, 1, 9} 이고 +0x110 == 0 이면 c.vt14(루 j 좌표) · AI j + 2
 * ```
 * 0xb1b88(P, b) "그 루에 커버가 필요한가" (직접 뜬 것):
 * ```
 * b1b9e  state[7] == 0 → 0 ; 어느 야수든 AI 8 → 1
 * b1bae  주자 R 마다 +0x94 && +0x88 == b && 아웃 아님 → 1
 * b1bde  타자주자(목록 0)가 살아 있고 P+0x168 ∈ {6,7,8} ∪ {12,13,14} → 1
 * b1c0a  r = b == 0 ? 4 : b ; 루 r 의 주자(0xa97a0: 아웃 아닌 +0x8c == r 첫 주자)가 있으면 1
 *        아니면 루 r−1 의 주자가 있으면 1 · 아니면 루 r−2 의 주자가 있고 그 +0x7c == r−1 이면 1 · 그 밖 0
 * ```
 * ⚠️ 미해결 (지어내지 않고 둔 것):
 * - P+0x168 을 쓰는 곳을 못 찾았다 — 타자주자 갈래(b1bde)는 안 선다고 본다. 타자주자는 +0x8c == 0 이라 루 1 은
 *   "루 r−1 의 주자" 로 어차피 선다
 * - state[7] · +0x110 · 판 끝(+0x111 · +0x129 && 공 틱 > 담장 틱, b1ca2) 관문은 판이 도는 동안 막지 않는다고 본다
 * - vtcc(0xa2138 = +0xb0 == 0 && +0xb4 ≤ 0 && +0xcc ≤ 0)는 이 진행기에 없는 동작 잠금이라 늘 참으로 본다
 * - +0x94 는 웹의 `requiredBase ≠ −1` 로 읽는다(0xa95e8 · 0xa9620 이 둘을 함께 세우고 지운다)
 */

/** 0xd8758 — 타격 지점. 공 시작점이 여기면 타구 판이다 (b1ddc) */
const BATTING_START: WorldPoint = { x: 20_000, y: 1_000, z: 30_000 }

export interface CoverAssignmentInput {
  readonly context: DefenseContext
  /** 공 각 + 90 > 0 (b1e24 · b229e) — 웹은 포구점이 홈보다 1루 쪽인가로 읽는다(`secondBaseCoverSlot` 와 같은 값) */
  readonly ballToFirstSide: boolean
  /** 공.vt68(0) — 공 궤적의 첫 점 (b1ddc) */
  readonly ballStartPoint: WorldPoint
}

export interface CoverAssignment {
  /** 이번 틱에 b1c90 이 돌았나 — 어느 야수든 AI 8(협살)이면 안 돈다(b1c96) */
  readonly ran: boolean
  /** 새 +0xf0 (안 돌았으면 지난 값 그대로) */
  readonly covers: readonly number[]
  /** +0x138 — 2루 커버가 아닌 키스톤 야수(도움). 못 정했으면 −1 */
  readonly secondBaseHelper: number
  /** b1f06 에서 정한 2루 커버 — 공 가진 야수의 루(b23a4)·되찾기(b23dc) 앞, 자리 잡기 0xb203a 가 보는 값 */
  readonly secondBaseCover: number
  /** AI 0 으로 돌리는 야수들 (b1d38 투수 · b2540 커버를 내준 야수) */
  readonly idleSlots: readonly number[]
  /** AI 루 + 2 · 루 좌표를 받는 야수들 (b2564) */
  readonly coverStates: readonly { readonly slot: number; readonly base: number }[]
}

/** 목표점(+0x2c)이 루 좌표와 좌표까지 같은 첫 루 (0xb1268 · 야수 vt68 = 0xa0b4c) — 없으면 −1 */
export function baseAtPoint(point: WorldPoint): number {
  for (let base = 0; base <= 3; base += 1) {
    if (isSamePoint(point, basePosition(base))) return base
  }
  return NONE
}

/** 0xa97a0 — 아웃 아닌 주자 중 +0x8c(마지막으로 닿은 루) == b 인 첫 주자 */
function runnerOnBase(runners: readonly RunnerState[], base: number): RunnerState | undefined {
  return runners.find((runner) => !runner.isOut && runner.startBase === base)
}

/** 0xb1b88(P, b) — 그 루에 커버가 필요한가 (머리말 참고) */
export function needsCover(context: DefenseContext, base: number): boolean {
  const { fielders, runners } = context
  if (fielders.some((fielder) => fielder.aiState === AI_STATE.RUNDOWN)) return true
  if (runners.some((runner) => runner.requiredBase !== NONE && runner.requiredBase === base && !runner.isOut)) {
    return true
  }
  const r = base === 0 ? 4 : base
  const on = runnerOnBase(runners, r)
  if (on !== undefined) return true
  if (runnerOnBase(runners, r - 1) !== undefined) return true
  const twoBack = runnerOnBase(runners, r - 2)
  return twoBack !== undefined && twoBack.targetBase === r - 1
}

/** b2440 — 주자 하나라도 기본 야수 d 가 루 j 에 먼저 닿는가 */
function defaultFielderBeatsARunner(runners: readonly RunnerState[], base: number, fallback: FielderState): boolean {
  const fallbackTicks = fielderArrivalTicks(fallback)
  return runners.some((runner) => {
    const next = runner.startBase <= 3 ? runner.startBase + 1 : runner.startBase
    if (next === base) {
      if (runner.isOut) return false
      const ticks = isRunnerStopped(runner)
        ? ticksToReach(runner.position, basePosition(base), runner.speed)
        : runnerRemainingTicks(runner)
      return ticks > fallbackTicks
    }
    if (runner.targetBase === ((base + 3) & 3)) return runnerOneMoreBaseTicks(runner) > fallbackTicks
    return false
  })
}

/** 0xb1c90 의 커버 부분 한 번 (머리말 참고) */
export function assignCoversForTick(input: CoverAssignmentInput): CoverAssignment {
  const { context } = input
  const { play, fielders, runners } = context
  if (fielders.some((fielder) => fielder.aiState === AI_STATE.RUNDOWN)) {
    return {
      ran: false,
      covers: play.coverOfBase,
      secondBaseHelper: NONE,
      secondBaseCover: NONE,
      idleSlots: [],
      coverStates: [],
    }
  }
  const covers = [...BASE_DEFAULT_FIELDER]
  const idleSlots: number[] = []
  const holderSlot = play.ballHolderSlot
  const holder = fielders[holderSlot]

  // ── b1d0a · b1d48: 기본 야수가 공을 가졌으면 그 루를 투수에게 ──
  const holderTargetBase = holder === undefined ? NONE : baseAtPoint(holder.target)
  if (
    holder !== undefined &&
    holderTargetBase !== NONE &&
    holderTargetBase === holderSlot - 1 &&
    holder.aiState !== AI_STATE.CHASE &&
    holder.aiState !== AI_STATE.RECEIVE
  ) {
    idleSlots.push(0)
  } else {
    const handed = holderSlot === 1 ? 0 : holderSlot === 2 ? 1 : holderSlot === 4 ? 3 : NONE
    if (handed !== NONE) {
      covers[handed] = 0
      if (!needsCover(context, handed)) covers[handed] = NONE
    }
  }

  // ── b1d96~b1f06: 2루 커버와 도움 ──
  const second = fielders[3]
  const short = fielders[5]
  // vtcc 는 늘 참으로 본다(머리말) — 둘째 항은 서지 않는다
  const blocked = second?.aiState === AI_STATE.CHASE
  let cover: number
  let helper: number
  if ((needsCover(context, 2) && !blocked) || isSamePoint(input.ballStartPoint, BATTING_START)) {
    if (holderSlot === 3) {
      cover = 5
      helper = 3
    } else if (holderSlot === 5) {
      cover = 3
      helper = 5
    } else {
      cover = input.ballToFirstSide ? 5 : 3
      helper = input.ballToFirstSide ? 3 : 5
    }
    const helperFielder = fielders[helper]
    if (helperFielder !== undefined && baseAtPoint(helperFielder.position) === 2) {
      const swapped = cover
      cover = helper
      helper = swapped
    }
  } else {
    const secondPoint = basePosition(2)
    const secondFar =
      second !== undefined &&
      short !== undefined &&
      horizontalDistance(second.position, secondPoint) > horizontalDistance(short.position, secondPoint)
    cover = secondFar ? 5 : 3
    helper = secondFar ? 3 : 5
  }
  covers[2] = cover

  // ── b23a4: 공 가진 야수가 루로 가고 있으면 그 루의 커버다 ──
  if (holder !== undefined && holderTargetBase !== NONE && holder.aiState !== AI_STATE.RECEIVE) {
    covers[holderTargetBase] = holderSlot
  }

  // ── b23dc: 쉬고 있는 기본 야수가 먼저 닿을 수 있으면 커버를 되찾는다 ──
  for (let base = 0; base <= 3; base += 1) {
    const current = covers[base]
    if (current === NONE) continue
    const fallbackSlot = BASE_DEFAULT_FIELDER[base]
    let substitute: FielderState | undefined
    if (current === fallbackSlot) {
      const pitcher = fielders[0]
      if (pitcher === undefined || baseAtPoint(pitcher.target) !== base) continue
      substitute = pitcher
      covers[base] = 0
    } else {
      substitute = fielders[current]
    }
    if (substitute === undefined || !isSamePoint(substitute.position, substitute.target)) continue
    const fallback = fielders[fallbackSlot]
    if (fallback === undefined || fallback.aiState !== AI_STATE.IDLE) continue
    if (!defaultFielderBeatsARunner(runners, base, fallback)) continue
    // b2536: 대신 선 야수가 AI 8 이면 아무것도 안 바꾼다
    if (substitute.aiState === AI_STATE.RUNDOWN) continue
    idleSlots.push(substitute.slot)
    covers[base] = fallbackSlot
  }

  // ── b2564: 커버 야수는 AI 루 + 2 로 그 루에 ──
  const coverStates: { slot: number; base: number }[] = []
  for (let base = 0; base <= 3; base += 1) {
    const slot = covers[base]
    if (slot === NONE) continue
    const fielder = fielders[slot]
    if (fielder === undefined) continue
    if (
      fielder.aiState === AI_STATE.RUNDOWN ||
      fielder.aiState === AI_STATE.CHASE ||
      fielder.aiState === AI_STATE.RECEIVE
    ) {
      continue
    }
    coverStates.push({ slot, base })
  }
  return { ran: true, covers, secondBaseHelper: helper, secondBaseCover: cover, idleSlots, coverStates }
}
