import { acceptsTargetVt14, isFreeToRetarget } from '@/entities/fielding/model/fielderPose'
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
  type PlayView,
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
 * b1dca  !0xb1b88(2) → b1e12 규칙(b1dd4 `beq`) · 막힘 → b1e12 규칙(b1dd8 `bne`) — 둘 다 아니면(커버가 필요하고 안 막힘)
 *        공.vt68(0)(공 첫 점) == 0xd8758(20000,1000,30000) 이면(0xbc0f4 = 세 좌표 같으면 1) b1e12 규칙,
 *        아니면 b1e86: 2루(0xd86c8)까지 거리가 먼 쪽이 돕는다 — 2루수가 멀면 (커버 5, 도움 3), 아니면 (3, 5)
 *        (r162 정정: 예전 웹은 "필요 && !막힘 → 규칙" 으로 거꾸로 읽었다. 타구 판은 공 첫 점이 늘 0xd8758 이라 차이가 없었다)
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
 * 남은 것 (지어내지 않고 둔 것):
 * - P+0x168 을 쓰는 곳이 바이너리에 없다(2026-10 r87 다시 훑음) — 읽는 곳은 b1b8a 하나다. 플레이 객체를 만드는 new(0x1fc)
 *   (0x3e756 → 0x1238 → 0x2ac4)는 0x28b8 로 받은 칸을 `memset(p, 0, 크기)`(0x2ad4 → 0x1400428)로 지우므로 늘 0 이다.
 *   상수 훑기(movs/lsls/adds · 리터럴 풀 · `adds rX, #i` + `[rX, #o]` · Thumb-2 `#0x168]`)로 플레이 쪽(0xa0000~0xb8000)
 *   에서 +0x168 에 쓰는 자리를 찾지 못했고, 플레이 객체(new(0x1fc) 0x3e756, 생성자 0xb0b68)도 이 칸을 안 적는다.
 *   그래서 갈래는 그대로 옮기되(`batterRunnerNeedsCover`) 칸 값은 생성 때 값 0 으로 둔다 → 안 선다.
 *   타자주자는 +0x8c == 0 이라 루 1 은 "루 r−1 의 주자" 로 어차피 선다
 * - 머리 관문 state[7] · 홈런(+0x111 · +0x129 && 공 틱 > 담장 틱, b1ca2)은 `coverTick.runCoverTick` 의 `gateClosed` 로 본다(r164).
 *   +0x110 은 b1c90 머리 관문이 아니다(b2564 줄의 +0x110 == 0 만 — 아래)
 * - b1d96 의 H.vtcc()(0xa2138 = +0xb0 워드 == 0 && +0xb4 ≤ 0 && +0xcc ≤ 0, 직접 뜬 것)는 `fielderPose.isFreeToRetarget` 로 다 본다(r171).
 *   vt30 은 AI 고리 vt4c 0xb45dc 끝(b4c72)이라 이 틱 머리 야수 틱이 줄이고 지운 값이다. 워드를 세우는 곳은 포구 동작 시작 b4134~b419c
 *   (표 0xd87f4 — 모든 포구 종류) · 뜬공 기다리기 vt9c(b4130) · 던지기(+0xb1)이고, 지우는 규칙은 야수 틱 a137a~a1456 이다
 *   (`fielderPose` 머리말). 곧 공 쫓는 유격수가 포구 동작을 시작한(또는 뜬공 밑에서 기다리는) 동안 2루가 막힌다.
 *   정정(r171): 예전 주석의 "vtc8 이 참이면 지운다"는 거꾸로다 — a1412 `bl vtc8` · a141a `beq a143e` 라 **거짓**(+0xb1 · +0xcc)일 때
 *   지운다(U-78 에뮬 확인과 같다). 가슴 높이 포구(7)의 +0xb0 은 프레임 5 까지 남는다
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
  /**
   * b1f06 바로 뒤 · b23a4 앞의 키스톤 자리 잡기 0xb203a — 2루 커버(+0xf0[2])를 받아 그때까지의 야수(b1d38 의 투수 AI 0 이 이미
   * 들어간)를 돌려준다. 자리 잡기가 바꾼 도움 야수의 목표점 · AI 0xa 를 b23a4(공 가진 야수의 목표 루) · b23dc(S.vt18 · d AI == 0) ·
   * b2564(c AI) 가 본다(`coverTick.runCoverTick`). 안 주면 자리 잡기가 없다
   */
  readonly placeHelper?: (fielders: readonly FielderState[], secondBaseCover: number) => readonly FielderState[]
  /** 플레이 +0x110(사건 7 파울) — 서 있으면 b2564(b2592~b259c)가 커버 야수에게 루 · AI 를 안 준다. 안 주면 0 */
  readonly foulFlag?: boolean
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
  /**
   * b2564 앞까지의 야수 — 자리 잡기(`placeHelper`)가 바꾼 것과 b1d38 · b2540 이 곧바로 적은 AI 0 이 들어 있다.
   * `applyCoverAssignment` 는 이것에 얹는다
   */
  readonly fielders: readonly FielderState[]
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

/**
 * 플레이 `+0x168` — 0xb1b88 의 타자주자 갈래(b1bde)만 읽는 칸. 쓰는 곳이 바이너리에 없어(머리말) 생성 때 값 그대로다.
 * 생성 때 값은 0 — new 0x1238 → 0x2ac4 가 memset(p, 0, 크기)(0x1400428) 한다(r115 직접 뜸).
 */
export const PLAY_FIELD_0X168 = 0

/**
 * b1bde~b1c08 (직접 뜬 것): 주자 목록 0 번(0xa9564(…, 0))이 있고 아웃 아니고(+0x96 == 0)
 * `(P+0x168 − 12) ≤ 2 || (P+0x168 − 6) ≤ 2`(부호 없는 비교 `bls`) 면 1.
 */
export function batterRunnerNeedsCover(runners: readonly RunnerState[], playField168: number = PLAY_FIELD_0X168): boolean {
  const first = runners[0]
  if (first === undefined || first.isOut) return false
  return (playField168 - 12) >>> 0 <= 2 || (playField168 - 6) >>> 0 <= 2
}

/** 0xb1b88(P, b) — 그 루에 커버가 필요한가 (머리말 참고) */
export function needsCover(context: DefenseContext, base: number): boolean {
  const { fielders, runners } = context
  if (fielders.some((fielder) => fielder.aiState === AI_STATE.RUNDOWN)) return true
  if (runners.some((runner) => runner.requiredBase !== NONE && runner.requiredBase === base && !runner.isOut)) {
    return true
  }
  if (batterRunnerNeedsCover(runners)) return true
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
      fielders,
    }
  }
  const covers = [...BASE_DEFAULT_FIELDER]
  const idleSlots: number[] = []
  const holderSlot = play.ballHolderSlot
  /** 함수 안에서 곧바로 바뀌는 야수 — b1d38 · b2540 의 AI 0(0xb8dbc 는 상태 칸만 적는다) · 자리 잡기 0xb203a */
  let working = fielders
  const idleNow = (slot: number): void => {
    working = working.map((fielder) => (fielder.slot === slot ? { ...fielder, aiState: AI_STATE.IDLE } : fielder))
  }
  const holder = working[holderSlot]

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
    idleNow(0)
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
  // b1d96~b1dc8 — 막힘 = 2루수 AI 1 || (유격수 AI 1 && !H.vtcc()) · H = +0x130(b1d0a 의 r5) — vtcc 는 자세 워드까지 본다(r171)
  const holderReady = holder === undefined || isFreeToRetarget(holder)
  const blocked = second?.aiState === AI_STATE.CHASE || (short?.aiState === AI_STATE.CHASE && !holderReady)
  let cover: number
  let helper: number
  // b1dce~b1e10 — 거리 갈래(b1e86)는 "2루 커버가 필요하고 · 안 막혔고 · 공 첫 점이 타격 지점이 아님" 일 때뿐
  const distanceBranch = needsCover(context, 2) && !blocked && !isSamePoint(input.ballStartPoint, BATTING_START)
  if (!distanceBranch) {
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

  // ── b1f06 → 0xb203a: 2루 커버가 아닌 키스톤 야수의 자리 잡기 (b23a4 앞 — 공 가진 야수가 도움 야수면 그 목표점도 바뀐다) ──
  if (input.placeHelper !== undefined) working = input.placeHelper(working, cover)

  // ── b23a4: 공 가진 야수가 루로 가고 있으면 그 루의 커버다 (b23a6 0xb0c90 을 다시 읽는다) ──
  const holderNow = working[holderSlot]
  const holderNowBase = holderNow === undefined ? NONE : baseAtPoint(holderNow.target)
  if (holderNow !== undefined && holderNowBase !== NONE && holderNow.aiState !== AI_STATE.RECEIVE) {
    covers[holderNowBase] = holderSlot
  }

  // ── b23dc: 쉬고 있는 기본 야수가 먼저 닿을 수 있으면 커버를 되찾는다 ──
  for (let base = 0; base <= 3; base += 1) {
    const current = covers[base]
    if (current === NONE) continue
    const fallbackSlot = BASE_DEFAULT_FIELDER[base]
    let substitute: FielderState | undefined
    if (current === fallbackSlot) {
      const pitcher = working[0]
      if (pitcher === undefined || baseAtPoint(pitcher.target) !== base) continue
      substitute = pitcher
      covers[base] = 0
    } else {
      substitute = working[current]
    }
    if (substitute === undefined || !isSamePoint(substitute.position, substitute.target)) continue
    const fallback = working[fallbackSlot]
    if (fallback === undefined || fallback.aiState !== AI_STATE.IDLE) continue
    if (!defaultFielderBeatsARunner(runners, base, fallback)) continue
    // b2536: 대신 선 야수가 AI 8 이면 아무것도 안 바꾼다
    if (substitute.aiState === AI_STATE.RUNDOWN) continue
    idleSlots.push(substitute.slot)
    idleNow(substitute.slot)
    covers[base] = fallbackSlot
  }

  // ── b2564: 커버 야수는 AI 루 + 2 로 그 루에 ──
  const coverStates: { slot: number; base: number }[] = []
  for (let base = 0; base <= 3; base += 1) {
    const slot = covers[base]
    if (slot === NONE) continue
    const fielder = working[slot]
    if (fielder === undefined) continue
    if (
      fielder.aiState === AI_STATE.RUNDOWN ||
      fielder.aiState === AI_STATE.CHASE ||
      fielder.aiState === AI_STATE.RECEIVE
    ) {
      continue
    }
    // b2592 — 플레이 +0x110(파울)이 서 있으면 건너뛴다
    if (input.foulFlag === true) continue
    coverStates.push({ slot, base })
  }
  return { ran: true, covers, secondBaseHelper: helper, secondBaseCover: cover, idleSlots, coverStates, fielders: working }
}

/** `assignCoversForTick` 의 답을 야수에게 — AI 0(b1d38 · b2540 0xb8dbc — AI 칸만, 목표는 다음 AI 0 b476a 가 고친다) 뒤 커버 야수 AI 루 + 2 · 루 좌표 (b1d38 · b2540 · b2564) */
export function applyCoverAssignment(
  fielders: readonly FielderState[],
  assigned: CoverAssignment,
): readonly FielderState[] {
  return fielders.map((fielder) => {
    let next = fielder
    if (assigned.idleSlots.includes(fielder.slot)) {
      next = { ...next, aiState: AI_STATE.IDLE }
    }
    const cover = assigned.coverStates.find((entry) => entry.slot === fielder.slot)
    if (cover !== undefined) {
      // b25b6 vt14(루 좌표) = 0xa14c8 — 잠금 +0xb4 ≤ 0 · vtc8(+0xb1 · +0xcc)일 때만 목표를 받는다(r196). AI 는 b25c4 가 늘 루 + 2
      next = acceptsTargetVt14(next)
        ? { ...next, aiState: AI_STATE.COVER_HOME + cover.base, target: basePosition(cover.base), targetBase: cover.base }
        : { ...next, aiState: AI_STATE.COVER_HOME + cover.base }
    }
    return next
  })
}

/**
 * **0xb2a48(P, f, 루)** — 루 커버 칸을 f 가 가져간다 (직접 뜬 것, r176):
 * ```
 * b2a52  C = +0xf0[루 % 4] ; C == −1 || C == f 면 끝
 * b2a7e  C.AI = 0 (0xb8dbc — +0x84 만)
 * b2a8a  +0xf0[루] = f ; f.vt48(루) = 0xa0a18 → vt14(루 좌표 0xd78f0[루 % 4]) ; f.AI = 루 + 2
 * b2ab6  +0x130 == C 면 +0x130 = f
 * ```
 * 부르는 곳: 루로 보내기 0xb2c90 의 직접 밟기(b2d64 — `runDefensePlay.sendToBase`)와 AI 2~5 의 b4814(+0x3b && vtcc).
 * 내려간 C 는 목표를 안 고친다 — 다음 걸음 전 AI 0 b476a 가 vtcc 면 시작 자리로 고친다.
 */
export function claimCoverOfBase<P extends Pick<PlayView, 'coverOfBase' | 'ballHolderSlot'>>(
  play: P,
  fielders: readonly FielderState[],
  slot: number,
  base: number,
): { readonly play: P; readonly fielders: readonly FielderState[] } {
  const previous = play.coverOfBase[((base % 4) + 4) % 4] ?? NONE
  if (previous === NONE || previous === slot) return { play, fielders }
  const coverOfBase = [...play.coverOfBase]
  coverOfBase[base] = slot
  return {
    play: { ...play, coverOfBase, ballHolderSlot: play.ballHolderSlot === previous ? slot : play.ballHolderSlot },
    fielders: fielders.map((fielder) =>
      fielder.slot === previous
        ? { ...fielder, aiState: AI_STATE.IDLE }
        : fielder.slot === slot
          ? // vt48 0xa0a18 → vt14(루 좌표) — 관문(`acceptsTargetVt14`)이 막으면 목표는 그대로(r196)
            acceptsTargetVt14(fielder)
            ? { ...fielder, target: basePosition(base), targetBase: base, aiState: AI_STATE.COVER_HOME + base }
            : { ...fielder, aiState: AI_STATE.COVER_HOME + base }
          : fielder,
    ),
  }
}
