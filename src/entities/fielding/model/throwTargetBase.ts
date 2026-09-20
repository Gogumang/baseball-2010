import {
  BASE_POSITIONS,
  BASE_SCORE,
  isOutfieldSlot,
  isSamePoint,
  ticksToReach,
} from '@/entities/fielding/model/fieldGeometry'
import {
  isRunnerStopped,
  NONE,
  runnerOneMoreBaseTicks,
  runnerRemainingTicks,
  type DefenseContext,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { defenseArrivalTicks } from '@/entities/fielding/model/throwArrival'
import { INFIELD_READY_TICKS, planThrow } from '@/entities/fielding/model/throwPlan'
import { integerSquareRoot } from '@/shared/lib/math/originalTrigonometry'

/**
 * CPU 송구 목표 루 고르기 **0xafb24** (제어기 vt 0x14) — S7 2·3·4절에서 식까지 확정된 그대로 옮긴다.
 *
 * 루 4칸짜리 후보표(0x30바이트)를 채워 `루 기본 점수 0xd85ac` 에 "확실한 아웃이면 100000 + 여유,
 * 아니면 10000"(홈이면 각각 +10000000 / +1000000)을 얹고, 첫 루 항에 2배 가중을 준 뒤
 * `2×첫 루 항 + 둘째 루 항 + 500` 과 기본 점수 합을 더해 최댓값을 고른다.
 *
 * 난이도는 `난이도 + 유효 > 2` 한 곳에서만 쓰인다: 높으면 "여유가 가장 큰 루"(안전한 아웃),
 * 낮으면 점수식(= 앞 루 욕심)으로 간다.
 */

/** 확실한 아웃 후보의 기본 점수 */
const SURE_OUT_SCORE = 100_000
/** 불확실한 후보의 기본 점수 */
const UNSURE_SCORE = 10_000
/** 홈 + 확실 보너스 */
const HOME_SURE_BONUS = 10_000_000
/** 홈 + 불확실 보너스 */
const HOME_UNSURE_BONUS = 1_000_000
/** "그 루로 던지는 사이 다른 주자가 한 루 더 간다" 감점 두 단계 (0xffff5038 / 0xffffa81c) */
const LATE_PENALTY = 45_000
const NEAR_PENALTY = 22_500
/** 점수 바닥값 — 후보가 없어도 0 이 되지 않게 한다 */
const SCORE_FLOOR = 500
/** 커버가 없는 루로의 재송구에 쓰는 큰 값 (0xafe1e) */
const NO_RETHROW_TICKS = 100
/** 고르기 시작값 (0xb0164) */
const INITIAL_BEST = 1000
/** 1루수 예외가 걸리는 점수 상한 (0xb0290) */
const FIRST_BASEMAN_SCORE_LIMIT = 19_999
/** 태그 거리와 같은 값 — 1루선에서 이만큼 안쪽이어야 "직접 밟을 수 있다" 로 친다 (0xafd5a) */
const FIRST_BASE_LINE_DISTANCE = 499

interface BaseCandidate {
  /** +0 주자 도착 틱 (없으면 −1) */
  runTick: number
  /** +2 포스/리터치 의무 표시 */
  force: boolean
  /** +3 플레이 vt 0x80 — "포스로 밀려 오는 주자인가" */
  forced: boolean
  /** +4 수비 도착 틱 */
  defTick: number
  /** +6 + 2r 루 b 로 보낸 뒤 다시 루 r 로 보내는 틱 */
  rethrow: number[]
}

/**
 * 플레이 vt 0x80 = 0xb1b54 — "내 목표 루가 바로 앞 주자가 떠난 루" = 포스로 밀려 가는 주자 (S7 3-0).
 */
export function isForcedRunner(play: PlayView, runners: readonly RunnerState[], index: number): boolean {
  if (index === 0) return true // 타자주자는 늘 1
  if (!play.everHeld) return false
  const runner = runners[index]
  const previous = runners[index - 1]
  if (runner === undefined || previous === undefined) return false
  return runner.targetBase === previous.startBase
}

export interface ThrowTargetInput extends DefenseContext {
  /** 제어기 +0x10 전역 설정 +6 바이트. 0~1 이면 점수식, 3 이상이면 늘 "여유 최대" 규칙 */
  readonly difficulty: number
  /** 0xa990c(주자관리) = 살아 있는 주자 수. 0 이고 내야수가 잡았으면 안 던진다 */
  readonly activeRunnerCount: number
}

/** 루 번호를 0~3 으로 (원본 표는 5칸이고 [4] 가 홈의 사본) */
const wrap = (base: number) => ((base % 4) + 4) % 4

/** s8 자르기 — 원본이 재송구 틱을 바이트 칸에 넣었다가 부호 있는 바이트로 읽는다 (0xafe8c) */
function toSignedByte(value: number): number {
  const byte = ((value % 256) + 256) % 256
  return byte > 127 ? byte - 256 : byte
}

/** 후보표를 채운다 (S7 2절) */
function buildCandidates(input: ThrowTargetInput): BaseCandidate[] {
  const { play, runners } = input
  const table: BaseCandidate[] = Array.from({ length: 4 }, () => ({
    runTick: NONE,
    force: false,
    forced: false,
    defTick: 0,
    rethrow: [0, 0, 0, 0],
  }))

  runners.forEach((runner, index) => {
    if (runner.isOut) return
    let slot: number
    if (runner.settled && runner.requiredBase >= 0 && !runner.isBatterRunner) {
      slot = wrap(runner.requiredBase)
      table[slot].force = true
      // 되돌아가야 하면 "한 루 더 가는 총 틱"(vt0xa0), 앞으로 가면 남은 틱(0xbefec)
      table[slot].runTick =
        runner.startBase > runner.requiredBase ? runnerOneMoreBaseTicks(runner) : runnerRemainingTicks(runner)
    } else {
      slot = wrap(runner.startBase)
      table[slot].runTick = runnerRemainingTicks(runner)
    }
    table[slot].forced = isForcedRunner(play, runners, index)
  })
  return table
}

/**
 * 1루에 커버가 없을 때의 예외 (S7 2-6).
 * 공 가진 야수가 1루선에서 499 이내에 있고 타자주자보다 먼저 1루에 닿으면
 * **수비 틱 = 주자 틱** 으로 적어 "보낼 수 있는 루" 로 친다(= 직접 밟는다).
 */
function applyFirstBaseException(input: ThrowTargetInput, candidate: BaseCandidate): void {
  const holder = input.fielders[input.play.ballHolderSlot]
  const home = BASE_POSITIONS[0]
  const first = BASE_POSITIONS[1]
  const slope = Math.trunc((100 * (home.z - first.z)) / (home.x - first.x))
  const numerator = Math.abs(slope * (holder.position.x - home.x) - 100 * (holder.position.z - home.z))
  const denominator = integerSquareRoot(slope * slope + 100 * 100)
  const lineDistance = Math.trunc(Math.trunc(numerator / denominator) / 10)
  if (lineDistance > FIRST_BASE_LINE_DISTANCE) return

  const batterRunner = input.runners[0]
  if (batterRunner === undefined) return
  const runnerTicks = ticksToReach(batterRunner.position, first, batterRunner.speed)
  const fielderTicks = ticksToReach(holder.position, first, holder.speed)
  if (runnerTicks > fielderTicks) candidate.defTick = candidate.runTick
}

/** 루 b 로 보낸 뒤 다시 루 r 로 보내는 틱 (S7 2-5) */
function rethrowTicks(input: ThrowTargetInput, from: number, to: number): number {
  const { play } = input
  const coverTo = play.coverOfBase[wrap(to)] ?? NONE
  if (coverTo === NONE) return NO_RETHROW_TICKS
  const coverFrom = play.coverOfBase[wrap(from)] ?? NONE
  const throwerSlot = coverFrom !== NONE ? coverFrom : input.fielders[play.ballHolderSlot].slot
  const plan = planThrow({
    fielders: input.fielders,
    fromSlot: throwerSlot,
    finalSlot: coverTo,
    base: to,
  })
  // **원본 그대로**: 중계 포함 전체 틱([6])이 아니라 1구간 틱([5])을 쓴다 → 외야 재송구를 실제보다 짧게 본다 (S7 4-1)
  return toSignedByte(plan.firstLegTicks)
}

export interface ThrowTargetDebug {
  readonly candidates: readonly BaseCandidate[]
  readonly margins: readonly number[]
  readonly topScores: readonly number[]
  readonly sure: boolean
  readonly chosen: number
}

/** 송구 목표 루. −1 이면 안 던진다 */
export function chooseThrowTargetBase(input: ThrowTargetInput): number {
  return describeThrowTarget(input).chosen
}

/** 점수판까지 함께 돌려준다 — 화면·테스트가 "왜 그 루인가" 를 보여 줄 때 쓴다 */
export function describeThrowTarget(input: ThrowTargetInput): ThrowTargetDebug {
  const { play, fielders, runners } = input
  const holder = fielders[play.ballHolderSlot]
  const holderIsInfield = !isOutfieldSlot(holder.slot)
  const empty: ThrowTargetDebug = {
    candidates: [],
    margins: [NONE, NONE, NONE, NONE],
    topScores: [0, 0, 0, 0],
    sure: false,
    chosen: NONE,
  }
  // 주자가 없고 내야수가 잡았으면 안 던진다 (0xafb7e)
  if (input.activeRunnerCount === 0 && holderIsInfield) return empty

  const table = buildCandidates(input)

  // 루마다 수비 틱 + 가장 빠른 루 (S7 2-4)
  let minimumDefTick = INITIAL_BEST
  let minimumBase = 0
  for (let base = 0; base < 4; base += 1) {
    table[base].defTick = defenseArrivalTicks(input, base)
    if ((play.coverOfBase[base] ?? NONE) === NONE && base === 1) {
      applyFirstBaseException(input, table[base])
    }
    if (table[base].defTick < minimumDefTick) {
      minimumDefTick = table[base].defTick
      minimumBase = base
    }
  }
  for (let base = 0; base < 4; base += 1) {
    for (let other = 0; other < 4; other += 1) {
      if (other === base) continue
      table[base].rethrow[other] = rethrowTicks(input, base, other)
    }
  }

  // 공 가진 야수가 어느 루 위에도 안 서 있고 투수도 아니다 (3-2 의 "밖")
  const outside =
    !BASE_POSITIONS.some((point) => isSamePoint(holder.position, point)) && holder.slot !== 0

  const margins = [NONE, NONE, NONE, NONE]
  const topScores = [0, 0, 0, 0]
  let sure = false
  const scoreA: number[][] = []
  const scoreB: number[][] = []

  for (let base = 0; base < 4; base += 1) {
    const candidate = table[base]
    const margin = candidate.runTick - candidate.defTick
    let effective = 0
    let termA = 0
    let termB = 0

    if (margin >= 0 && candidate.runTick !== 0) {
      termA = BASE_SCORE[base]
      if (candidate.forced || candidate.force) {
        margins[base] = margin
        effective = 1
        termB = SURE_OUT_SCORE + margin
        if (base === 0) termA += HOME_SURE_BONUS
      } else {
        if (base === 0) termA += HOME_UNSURE_BONUS
        termB = UNSURE_SCORE
      }

      // 주자별 보정 (3-2)
      for (const runner of runners) {
        if (runner.isOut) continue
        const nextBase = wrap(runner.targetBase + 1)
        const reach = INFIELD_READY_TICKS + candidate.defTick + rethrowTicks(input, base, nextBase)
        const oneMore = runnerOneMoreBaseTicks(runner)
        if (reach + 2 >= oneMore && nextBase !== base) {
          termB -= reach >= oneMore ? LATE_PENALTY : NEAR_PENALTY
          continue
        }
        if (runner.startBase === base) {
          if (outside) termB += base === 0 ? 5004 : 5000 + base
          if (!isRunnerStopped(runner)) termB += 10_000
        } else if (nextBase === base && outside) {
          // 원본 그대로: b(0~3) 와 비교하는 max 라 termB 가 음수일 때만 올라간다 (사실상 무효, S7 3-2)
          termB = Math.max(termB, base)
        }
      }
    }

    // 두 번째 루(병살 상대) 점수 (3-3)
    scoreA[base] = [0, 0, 0, 0]
    scoreB[base] = [0, 0, 0, 0]
    for (let other = 0; other < 4; other += 1) {
      const secondReach = candidate.defTick + candidate.rethrow[other]
      const secondMargin = table[other].runTick - secondReach
      let termC = 0
      let termD = 0
      if (effective === 1 && other !== base && secondMargin > 0) {
        termC = BASE_SCORE[other]
        if (table[other].forced || table[other].force) {
          termD = SURE_OUT_SCORE + secondMargin
          if (other === 0) termC += HOME_SURE_BONUS
        } else {
          termD = UNSURE_SCORE
          if (other === 0) termC += HOME_UNSURE_BONUS
        }
      }
      scoreA[base][other] = termA + termC
      scoreB[base][other] = 2 * termB + termD + SCORE_FLOOR
    }
    if (input.difficulty + effective > 2) sure = true
  }

  // ── 고르기 (3-4) ──
  let best = INITIAL_BEST
  let chosen = minimumBase

  if (sure) {
    // (가) 여유가 가장 큰 루
    best = NONE
    for (let base = 0; base < 4; base += 1) {
      if (margins[base] > best && margins[base] >= 0) {
        best = margins[base]
        chosen = base
      }
    }
  } else {
    // (나) 점수식. 같은 점수면 뒤 루가 이긴다 (원본의 `최고 ≤ 최고점` 비교)
    for (let base = 0; base < 4; base += 1) {
      for (let other = 0; other < 4; other += 1) {
        const score = scoreA[base][other] + scoreB[base][other]
        topScores[base] = Math.max(topScores[base], score)
        if (best <= topScores[base]) {
          best = topScores[base]
          chosen = base
        }
      }
    }
    // 1루수 예외: 포구할 야수가 1루수이고 1루 좌표에 정확히 서 있으며 점수가 전부 낮으면 1루
    const catchFielder = fielders[play.catchFielderSlot]
    if (
      catchFielder !== undefined &&
      catchFielder.slot === 2 &&
      isSamePoint(catchFielder.position, BASE_POSITIONS[1]) &&
      topScores.every((score) => score <= FIRST_BASEMAN_SCORE_LIMIT)
    ) {
      chosen = 1
    }
  }

  // (다) 아무 후보도 점수를 못 얻었으면 — **1루수 예외로 정한 1 도 여기서 뒤집힌다 (원본 그대로)**
  if (best === INITIAL_BEST) {
    const catchFielder = fielders[play.catchFielderSlot] ?? holder
    chosen = isOutfieldSlot(catchFielder.slot) ? 2 : NONE
  }

  return { candidates: table, margins, topScores, sure, chosen }
}

/**
 * CPU 송구 결정 0xafa60 — 목표 루를 고른 뒤 **홈 송구는 20% 확률로 특수(레이저급)** 송구가 된다.
 * 난수는 바깥에서 주입한다.
 */
export const HOME_SPECIAL_THROW_PERCENT = 20

export function isSpecialThrow(base: number, roll: number): boolean {
  return base === 0 && roll < HOME_SPECIAL_THROW_PERCENT
}

/** 루 좌표에 정확히 서 있는 루 번호 — 0xb1268. 없으면 −1 */
export function baseAtPoint(point: { x: number; y: number; z: number }): number {
  const index = BASE_POSITIONS.findIndex((base) => isSamePoint(base, point))
  return index < 0 ? NONE : index
}
