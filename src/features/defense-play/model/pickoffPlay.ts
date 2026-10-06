import type { RandomPort } from '@/shared/api/random/randomPort'
import { PICKOFF_PLAY_KIND, type PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import {
  NO_THROW_ERROR,
  rollThrowError,
} from '@/entities/fielding/model/fieldingErrors'
import {
  basePosition,
  FIELDER_START_POSITIONS,
  horizontalDistance,
  isSamePoint,
  runnerSpeedOf,
  stepToward,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  fielderArrivalTicks,
  createRunner,
  initialPlayView,
  NONE,
  type DefenseContext,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { judgeOut, OUT_KIND, releaseForcesAfterOut } from '@/entities/fielding/model/outJudgement'
import { startPickoff } from '@/entities/fielding/model/pickoff'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { defenseArrivalTicks } from '@/entities/fielding/model/throwArrival'
import { planThrow, readyTicksOf, thrownWith, throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import { viewStateOf, type ActionMemory, type DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import {
  cpuSpecialThrowOf,
  errantArrivalTicks,
  specialThrowArrivalTicks,
  type DefensePlayResult,
} from '@/features/defense-play/model/runDefensePlay'
import { runnerFateOf } from '@/features/defense-play/model/runnerFates'

/**
 * **견제 한 판** — 플레이 종류 4 를 틱 단위로 돌린다 (0x50f28 → 상태 0x17 → 0xb28be · 0xb47da · 0xb4292).
 *
 * 타구 진행기 `runDefensePlay` 와 따로 둔 까닭: 그쪽은 "목록 0번 = 타자주자 · 타구 궤적 · 포구 예보" 를
 * 전제로 짜여 있는데 견제에는 셋 다 없다. 원본도 같은 플레이 객체를 쓰되 **종류별 시작(vt0x18)** 이 갈라져
 * 종류 4 는 타자주자를 만들지 않고(0x46418 의 0xa93ac 는 종류 1 전용 길) 투수가 공을 쥔 채 시작한다.
 *
 * ## 원본 흐름 (전부 문서 근거 — S8 3절·6절 · I-controls 4a·2b)
 * 1. **시작 0xb28be**: 공 쥔 야수 = 투수(P+0x130 = 0) · 쥠(P+0x12c = 1) · state[0x1e] = 1 ·
 *    야수 1~4 를 루 0~3 좌표(0xd86b0 = 0xd78f0)로 보내고 커버 = 루번호+1 · 투수 AI 상태 0xe.
 *    → `entities/fielding/model/pickoff.startPickoff` 가 그대로 만든다.
 * 2. **상태 0x17 진입 0x46418**: 주자 고리 0x4657e 가 주자마다 `0x3d7b8` — 다음 루로 5 틱(1% 로 10 틱) 몰아
 *    돌리고 목표를 닿은 루로 되돌린다(9976cb7, `runnerLead`). 이어 0x4677a 가 살아 있는 주자를 모두
 *    `vt0x48(+0x8c)` = 마지막으로 닿은 루로. ⚠️ S8 6-3 의 "리드 폭이 없다" 는 이 고리를 놓친 것 — 판이 열리면
 *    주자는 루를 떠나 돌아오는 중이라 **태그될 수 있다**.
 * 3. **AI 상태 0xe 0xb47da**: `플레이.vt0x58(state[0x27])` = 0xb2c90 → 커버가 있고 그 커버의 목표 루가
 *    대상 루면 던진다. 던지기는 야수 vt0xac = 0xa1620 이고 그 안에서 **악송구 굴림 0xa1828** 이 돈다.
 * 4. **아웃 판정 0xb36d0** 이 틱마다 그대로 돈다 — 거르개 0x58d 에 4 가 없다(I 3c). 루에 닿은 주자는
 *    "아직 움직이는 중" 이 아니라 안 죽지만, 리드에서 돌아오는 중에 공이 오면 태그(≤499)로 죽는다.
 * 5. **포구 0xb4292**: 받은 야수가 루 b 위(vt0x58, 좌표 완전일치)에 서 있고 `0xa97a0`(b 에 마지막으로
 *    닿은 산 주자)가 제 목표점에 서 있으면(vt0x18) **결과 코드 9 = 세이프** → 0x51c14 → 소리 17.
 *
 * ## 난수 — 이 판이 굴리는 것
 * 판이 열릴 때 주자마다 리드 덧틱 `rand(0,100)` 한 번(0x3d7b8, 목록 차례) → **악송구 굴림 한 번**(`rand(0,10000)`),
 * 악송구면 넷 더(수평·수직 속도 · 방향 크기 · 부호, `errantThrowFlight`) — 0xa1828 그대로. 그 밖은 없다.
 *
 * ## 근사·미해결 (지어내지 않은 자리)
 * - ⚠️ **송구 시각**: 원본은 0xb2c90 이 "커버의 목표 루가 대상 루면" 곧바로 던지고 공은 궤적 물리
 *   (0xb401c, 해독 금지 구역)로 날아간다. 여기서는 타구 진행기와 같은 `defenseArrivalTicks`
 *   (송구 틱과 커버가 루에 닿는 틱 중 늦은 쪽)로 도착 틱을 잡는다 — **근사**다.
 * - ⚠️ **악송구 뒤**: 방향 보정(±49)이 공을 루 밖으로 보내는데 그 궤적이 해독 금지 구역이다.
 *   타구 진행기와 같은 근사("그 송구는 아무도 못 받는다, 속도 보정만 도착 틱에 먹인다")를 쓴다.
 *   원본에서 빠진 공을 보고 주자가 더 가는지는 **미해결**이다.
 * - ⚠️ **커버 야수의 AI 상태**: 0xb28be 는 목표 좌표만 세우고 AI 상태를 따로 쓰는 줄이 문서에 없다.
 *   여기서는 목표 좌표로 걸어가게만 한다.
 * - ⚠️ **레이저 굴림(0x66a8c)을 안 굴린다**: 창 0xb2648 이 보는 포구 틱(P+0x174)을 견제 시작이
 *   세우지 않아 그 값이 무엇인지 문서에 없다. 굴림 차례를 지어 넣지 않는다 — **미해결**.
 * - 메시지 처리기 0x509a0 앞머리는 CPU 송구 결정이 아니라 경기 로직의 빈 함수 0xae5f8 을 부른다(S8 4-3 정정,
 *   `runDefensePlay` 의 `throwMode` 주석). 0xafa60 을 부르는 곳은 둘이다 — 견제 아웃(결과 13) 뒤 결과 메시지 0xbba 의
 *   한 번(사람·CPU 모두)과 슬롯 2 의 매 틱(`0xae6c8` = 수비 CPU || 송구 설정 자동, `defenseIsCpu` · `throwMode`).
 *   받은 야수는 쥐기 0xb2710 이 +0x128 = 1 · 준비 틱 3 을 넣어, 준비가 끝난 틱에 점수식이 루를 고르면 0xb2c90 →
 *   0xb2e38(AI 9 미루기 · 악송구 굴림 · 던진 야수 AI 0)로 이어 던진다. ⚠️ 부르는 쪽(경기 흐름들)이 아직 수비 CPU·송구
 *   설정을 안 넘긴다 — 안 넘기면 슬롯 2 갈래는 안 돈다. 표본에서는 그 갈래가 돌아도 점수식이 던질 루를 못 찾는다.
 * - **사람 조작**: 견제 중 사람 키(송구 0x588)는 받지 않는다. 공은 처음부터 대상 루로 가고 있고 포구 틱에
 *   판정이 끝나므로(결과 9) 바꿀 것이 없어서, 이 판은 **미리 끝까지 돌려** 재생만 한다.
 */

/** 진행기가 이 틱을 넘기면 끊는다 — 우리 쪽 안전망 (타구 진행기 240 과 같다) */
const MAXIMUM_TICKS = 240
/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
const DEFAULT_ABILITY = 500
/** 투수 칸 */
const PITCHER_SLOT = 0
/** 결과 코드 — 9 세이프(0xb4292) · 13 아웃(0xb4556) */
export const PICKOFF_RESULT = { SAFE: 9, OUT: 13 } as const
export type PickoffResultCode = (typeof PICKOFF_RESULT)[keyof typeof PICKOFF_RESULT]

/** 판정 콜 — 0x51c14 머리 세 줄이 종류 4·5 를 따로 빼 **다른 검사 없이** `movs r1,#0x11` 로 간다 */
const SAFE_CALL = 17
/** 아웃 콜 — 0x51b36: state[0x1f](뜬공 포구)·state[0x87](마지막 판정이 태그) 중 하나면 62, 아니면 20 */
const CAUGHT_OUT_CALL = 62
const FORCE_OUT_CALL = 20

export interface PickoffPlayInput {
  /** state[0x27] — 견제 대상 루 */
  readonly targetBase: PickoffBase
  /** 견제 때 루 상황 */
  readonly bases: BaseState
  readonly outs: number
  /** 수비 9명 능력치 (칸 순서). 칸 0(투수)은 원본 그대로 레코드 칸 2 를 읽는다(`defenseAbilitiesOf`) */
  readonly defenseAbilities?: readonly number[]
  /** 주자들의 주루 능력치 */
  readonly runAbility?: number
  /** 주면 악송구 굴림(0xa1828)이 돈다 */
  readonly random?: RandomPort
  /** `0xae690` 앞 항 — 공격이 CPU 인가 (자동 진루 제어기 0xaf918 을 켜는 조건) */
  readonly offenseIsCpu?: boolean
  /** 주루 설정 +0xbd. 안 주면 자동 */
  readonly runningMode?: ManualAutoMode
  /**
   * `0xae6c8` 앞 항 — 수비가 CPU 인가. 송구 설정(`throwMode`)과 함께 슬롯 2 의 매 틱 CPU 송구 결정 0xafa60 을 켠다.
   * 안 주면 사람 수비(그 갈래가 안 돈다 — 지금까지와 같다).
   */
  readonly defenseIsCpu?: boolean
  /** 송구 설정 +0xf4 (원본 기본 수동) — `0xae6c8` 뒤 항 */
  readonly throwMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
}

export interface PickoffPlayResult extends DefensePlayResult {
  readonly targetBase: PickoffBase
  /** 9 세이프 · 13 아웃 · null(포구 판정 없이 끝남 — 악송구) */
  readonly resultCode: PickoffResultCode | null
}

interface PickoffRunner {
  state: RunnerState
  counted: boolean
}

/**
 * 견제 한 판을 끝까지 돌린다. 경기 상태는 건드리지 않고 결과(`advance`)만 돌려준다.
 */
export function runPickoffPlay(input: PickoffPlayInput): PickoffPlayResult {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const speed = runnerSpeedOf(input.runAbility ?? DEFAULT_ABILITY)
  const autoBaserunningEnabled = input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동'
  const targetBase = input.targetBase
  const log: string[] = []
  const ticks: DefensePlayView[] = []
  const previousActions: ActionMemory = new Map<string, { action: number; since: number }>()

  // ── 1. 시작 0xb28be ──
  const start = startPickoff(targetBase)
  let fielders: readonly FielderState[] = createFielders(abilities).map((fielder) => {
    if (fielder.slot === PITCHER_SLOT) {
      return { ...fielder, holdingBall: true, aiState: start.pitcherAiState }
    }
    const goal = start.coverTargets.get(fielder.slot)
    if (goal === undefined) return fielder
    return { ...fielder, target: goal, targetBase: start.play.coverOfBase.indexOf(fielder.slot) }
  })
  // `manualThrowBase` 는 다리다(startPickoff 주석) — 웹 수비 판단 함수들이 사람 목표로 읽지 않게 지운다.
  // 대상 루는 이 함수의 `targetBase`(= state[0x27]) 가 들고 있다.
  let play: PlayView = { ...initialPlayView(start.play.kind), ...start.play, manualThrowBase: NONE }

  // ── 2. 상태 0x17 진입 0x46418 — 주자 고리 0x4657e 의 0x3d7b8: 주자마다 다음 루로 `0xcffac`[루] = 5 틱
  //    (+5 if rand(0,100) == 0) 몰아 돌린 뒤 목표를 닿은 루(+0x8c)로 되돌린다 → 판이 열리면 제 루로 돌아오는 중.
  //    그 뒤 0x4677a 가 살아 있는 주자를 모두 vt0x48(+0x8c) — 같은 목표다.
  // 목록은 루 순서(1·2·3) — 원본 0xa9a10 이 3·2·1 순으로 맨 앞에 끼워 넣어 같은 순서가 된다.
  // 번호는 1 부터 센다 — 0 은 타자주자 자리라 그림(`viewStateOf`)이 타자로 그리지 않게 비워 둔다.
  // 굴림: 주자마다 rand(0,100) 한 번(목록 차례) — 송구의 악송구 굴림(첫 틱)보다 앞이다.
  const runners: PickoffRunner[] = []
  ;([1, 2, 3] as const).forEach((base) => {
    const occupied = base === 1 ? input.bases.first : base === 2 ? input.bases.second : input.bases.third
    if (!occupied) return
    const runner = createRunner(runners.length + 1, base, speed, { isBatterRunner: false })
    const lead = runnerLeadOf(runner, { playKind: PICKOFF_PLAY_KIND, stealing: false, random: input.random })
    runners.push({ state: applyRunnerLead(runner, lead), counted: false })
  })

  let outs = input.outs
  let outsAdded = 0
  let runsScored = 0
  let tagOut = false
  let throwArrivalTick = -1
  let errantThrow = false
  let resultCode: PickoffResultCode | null = null
  /** 날아가는 송구 — 견제 송구와 그 뒤 받은 야수의 이어 던지기 (0xb2e38). 받을 야수가 −1 이면 악송구 */
  let flight: { from: number; base: number; releaseTick: number; arrivalTick: number; receiver: number } | null = null
  /** 첫(견제) 송구가 받는 쪽 손에 들어갔는가(악송구면 공이 루에 닿은 틱) */
  let caught = false
  let catchTick = -1
  /** 악송구로 공이 빠졌다 — 더는 아무도 쥐지 않는다 (근사) */
  let ballLost = false
  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 결과 메시지 0xbba */
  let outJudgedThisTick = false
  /** +0x15c · +0x158 — 0xb2e38 이 미룬 송구(AI 9)의 받을 야수 · 목표 루 */
  let deferredThrowReceiver = NONE
  let deferredThrowBase = NONE
  // `0xae6c8`([장면+0x214], 설정+0xf4) — 수비가 CPU 거나 송구 설정이 자동이면 슬롯 2 의 0xafa60 이 매 틱 돈다
  const cpuThrowEnabled = input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동'

  const runnerStates = () => runners.map((runner) => runner.state)
  const contextAt = (tick: number): DefenseContext => ({
    play,
    fielders,
    runners: runnerStates(),
    currentTick: tick,
    // 공은 처음부터 쥐어져 있다 — 낙구 틱은 0 으로 둔다 (자동 진루의 "잡힐 뜬공" 갈래가 안 서게)
    landingTick: 0,
  })

  /** 0xb36d0 한 번 — 타구 진행기의 `runOutJudgement` 와 같은 자리, 다만 타자주자 제외가 없다 */
  const runOutJudgement = (tick: number): void => {
    if (play.finished) return
    const judged = judgeOut(contextAt(tick))
    if (judged.kind === OUT_KIND.NONE) return
    const victim = runners[judged.runnerIndex]
    if (victim === undefined || victim.state.isOut) return
    victim.state = { ...victim.state, isOut: true, settled: true }
    outs += 1
    outsAdded += 1
    outJudgedThisTick = true
    tagOut = judged.kind === OUT_KIND.TAG
    resultCode = PICKOFF_RESULT.OUT
    log.push(`${tick}틱 ${victim.state.index}번 주자 견제사 (0xb36d0 결과 ${judged.kind})`)
    const relaxed = releaseForcesAfterOut(runnerStates())
    runners.forEach((runner, index) => {
      runner.state = relaxed[index] ?? runner.state
    })
  }

  /** 공 가진 야수 vtC4 — 쥐었고 준비 틱(+0xc8)이 다 줄었나 */
  const isHolderReady = (): boolean => {
    const holder = fielders[play.ballHolderSlot]
    return play.held && holder !== undefined && holder.holdingBall && holder.actionRemainingTicks <= 0
  }

  /**
   * 받은 야수의 이어 던지기 — 루로 보내기 0xb2c90 · 송구 0xb2e38 (`runDefensePlay` 의 sendToBase · throwBall 과 같은 갈래).
   * 커버 없음 → 공 든 채 그 루로(0) · 커버의 목표 루 ≠ 루(0) · 직접 밟는 게 빠름(1) · 600 이하 · 자기 자신(0) ·
   * 받는 야수가 1구간 틱 안에 못 닿음 → AI 9 로 미룸(1) · 그 밖 던진다(악송구 굴림 0xa1828)(1), 던진 야수는 AI 0.
   */
  const sendToBase = (tick: number, base: number, chooser: string, cpuSpecial: boolean): boolean => {
    const holderSlot = play.ballHolderSlot
    const holder = fielders[holderSlot]
    if (holder === undefined) return false
    const coverSlot = play.coverOfBase[wrapBase(base)] ?? NONE
    const basePoint = basePosition(base)
    if (coverSlot === NONE) {
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot ? { ...fielder, target: basePoint, targetBase: base } : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
      return false
    }
    const cover = fielders[coverSlot]
    if (cover === undefined || cover.targetBase !== base) return false
    const runTicks = ticksToReach(holder.position, basePoint, holder.speed)
    if (runTicks <= Math.max(throwTicksTo(holder, cover.target), fielderArrivalTicks(cover))) {
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot ? { ...fielder, target: basePoint, targetBase: base } : fielder,
      )
      if (runTicks > 0) log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
      return true
    }
    if (coverSlot === holderSlot || horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE) {
      return false
    }
    // ── 0xb2e38 ──
    if (!holder.holdingBall || holder.actionRemainingTicks > 0) return false
    const plan = planThrow({ fielders, fromSlot: holderSlot, finalSlot: coverSlot, base, special: cpuSpecial })
    const receiver = fielders[plan.toSlot]
    if (
      receiver !== undefined &&
      !isSamePoint(receiver.position, receiver.target) &&
      fielderArrivalTicks(receiver) > plan.firstLegTicks
    ) {
      if (holder.aiState === AI_STATE.RECEIVE) return false
      deferredThrowReceiver = plan.toSlot
      deferredThrowBase = plan.base
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot
          ? { ...fielder, aiState: AI_STATE.RECEIVE, target: basePosition(plan.base), targetBase: wrapBase(plan.base) }
          : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${plan.base}루 송구를 미룬다 — ${plan.toSlot}번 야수가 늦다 (AI 9)`)
      return true
    }
    const special = cpuSpecial ? cpuSpecialThrowOf(fielders, holderSlot, coverSlot) : null
    const isSpecial = special !== null && special.special
    const bounce = isSpecial && special.bounce
    if (bounce && input.random !== undefined) randomIntegerBelow(input.random, 0, 2)
    const error =
      input.random === undefined || bounce
        ? NO_THROW_ERROR
        : rollThrowError(abilities[holderSlot] ?? DEFAULT_ABILITY, isSpecial, input.random)
    fielders = fielders.map((fielder) => (fielder.slot === holderSlot ? thrownWith(fielder, isSpecial) : fielder))
    let arrival = isSpecial
      ? specialThrowArrivalTicks(contextAt(tick), base, fielders[holderSlot])
      : defenseArrivalTicks(contextAt(tick), base)
    if (error.errant && input.random !== undefined) {
      arrival = errantArrivalTicks(fielders, holderSlot, coverSlot, base, isSpecial, error, input.random)
    }
    if (error.errant) errantThrow = true
    flight = {
      from: holderSlot,
      base,
      releaseTick: tick,
      arrivalTick: tick + Math.max(1, arrival),
      receiver: error.errant ? NONE : coverSlot,
    }
    // b2f80 · b3070 손을 떠난다 · b2df8~b2e14 던진 야수가 커버(AI 2~5)도 AI 9 도 아니면 AI 0 (시작 자리로)
    fielders = fielders.map((fielder) => {
      if (fielder.slot !== holderSlot) return fielder
      const thrown = { ...fielder, holdingBall: false, actionRemainingTicks: 0 }
      const keeps =
        (fielder.aiState >= AI_STATE.COVER_HOME && fielder.aiState <= AI_STATE.COVER_THIRD) ||
        fielder.aiState === AI_STATE.RECEIVE
      return keeps
        ? thrown
        : { ...thrown, aiState: AI_STATE.IDLE, target: FIELDER_START_POSITIONS[holderSlot] ?? fielder.target, targetBase: NONE }
    })
    play = { ...play, held: false, catchFielderSlot: coverSlot, catchTick: flight.arrivalTick }
    log.push(
      `${tick}틱 ${holderSlot}번 야수가 ${base}루로 송구 — ${flight.arrivalTick}틱 도착` +
        (cpuSpecial ? ' (특수)' : '') +
        (error.errant ? ' (악송구)' : '') +
        chooser,
    )
    return true
  }

  /** CPU 송구 결정 0xafa60 — +0x128 && 준비 && AI ∉ {8, 9} 일 때 점수식 0xafb24, 홈이면 특수 굴림, 0xb2c90 이 성공하면 +0x128 = 0 */
  const cpuThrowDecision = (tick: number): void => {
    if (!play.wantsThrow || !isHolderReady() || ballLost || flight !== null) return
    if (fielders[play.ballHolderSlot]?.aiState === AI_STATE.RECEIVE) return
    const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
    const base = chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active, outs })
    if (base === NONE) return
    const cpuSpecial =
      base === 0 && input.random !== undefined && isSpecialThrow(base, randomIntegerBelow(input.random, 0, 100))
    if (sendToBase(tick, base, ' (CPU 결정)', cpuSpecial)) play = { ...play, wantsThrow: false }
  }

  for (let tick = 0; tick <= MAXIMUM_TICKS && !play.finished; tick += 1) {
    outJudgedThisTick = false
    // ── 야수 틱 0xa1284 — 공 쥔 야수의 준비 틱 +0xc8 −= 1 (공용 갱신 0x3f060 이 슬롯 2 보다 먼저, 타구 진행기 0' 절) ──
    fielders = fielders.map((fielder) =>
      fielder.holdingBall && fielder.actionRemainingTicks > 0
        ? { ...fielder, actionRemainingTicks: fielder.actionRemainingTicks - 1 }
        : fielder,
    )
    // ── 3. AI 상태 0xe — 0xb2c90 이 대상 루 커버에게 던진다 (첫 틱) ──
    if (tick === 0) {
      const coverSlot = play.coverOfBase[targetBase] ?? NONE
      const error =
        input.random === undefined
          ? NO_THROW_ERROR
          : rollThrowError(abilities[PITCHER_SLOT] ?? DEFAULT_ABILITY, false, input.random)
      errantThrow = error.errant
      let arrival = defenseArrivalTicks(contextAt(tick), targetBase)
      if (error.errant && input.random !== undefined) {
        // 악송구 갈래(a1868~a1908) — 흔들린 수평 속도·방향으로 도착 틱, 굴림 둘 더 (`errantArrivalTicks`)
        arrival = errantArrivalTicks(fielders, PITCHER_SLOT, coverSlot, targetBase, false, error, input.random)
      }
      throwArrivalTick = tick + Math.max(1, arrival)
      flight = {
        from: PITCHER_SLOT,
        base: targetBase,
        releaseTick: tick,
        arrivalTick: throwArrivalTick,
        receiver: errantThrow ? NONE : coverSlot,
      }
      // 던지면 공이 손을 떠난다 — b2f80 투수+0xe0 = 0 · b3070 +0x12c = 0 (날아가는 동안 투수는 태그 못 한다)
      fielders = fielders.map((fielder) =>
        fielder.slot === PITCHER_SLOT ? { ...fielder, holdingBall: false } : fielder,
      )
      play = { ...play, held: false }
      log.push(
        `${tick}틱 ${targetBase}루 견제 송구 — ${throwArrivalTick}틱 도착` + (errantThrow ? ' (악송구)' : ''),
      )
    }

    // ── 5. 송구 도착 = 포구 (0xb2710 → 0xb36d0, 그리고 0xb4292) ──
    // ⚠️ 근사: 도착 틱 추정(0xbf01c 가 나눗셈을 버림한다)이 커버가 실제로 루를 밟는 틱보다 한 틱 이를 수 있다
    // (2루수 → 2루가 그렇다). 원본은 공이 물리로 날아가 야수에게 닿는 순간 잡으므로, 여기서는 공이 루에 닿은 뒤
    // **커버가 루를 밟는 틱까지 포구를 미룬다** — 받는 쪽이 루 위에 서야 0xb4292 의 "선 루" 가 −1 이 아니다.
    // 이어 던진 송구도 같은 길이다.
    const inFlight = flight
    if (inFlight !== null && tick >= inFlight.arrivalTick) {
      if (inFlight.receiver === NONE) {
        flight = null
        ballLost = true
        caught = true
        play = { ...play, wantsThrow: false }
        log.push(`${tick}틱 악송구 — 받은 야수가 없다 (근사)`)
      } else if (isSamePoint(fielders[inFlight.receiver].position, basePosition(inFlight.base))) {
        flight = null
        if (!caught) catchTick = tick
        caught = true
        // 송구 받기 = 포구 틱 갈래 b42c8 의 쥐기 0xb2710(P, f, 1) — +0x128 = 1 · 준비 틱(+0xc8, 내야 3)
        const receiver = inFlight.receiver
        fielders = fielders.map((fielder) =>
          fielder.slot === receiver
            ? { ...fielder, holdingBall: true, actionRemainingTicks: readyTicksOf(receiver) }
            : fielder.holdingBall
              ? { ...fielder, holdingBall: false }
              : fielder,
        )
        play = { ...play, ballHolderSlot: receiver, catchFielderSlot: receiver, held: true, wantsThrow: true }
        runOutJudgement(tick)
        // 0xb4292 — 받은 야수가 선 루(vt0x58: 좌표 완전일치)에 마지막으로 닿은 산 주자가 제 목표점에 있으면 9
        const onBase = runners.find(
          (runner) => !runner.state.isOut && wrapBase(runner.state.startBase) === wrapBase(inFlight.base),
        )
        if (resultCode === null && onBase !== undefined && isAtTarget(onBase.state)) {
          resultCode = PICKOFF_RESULT.SAFE
          log.push(`${tick}틱 ${inFlight.base}루 세이프 (결과 9)`)
        }
      }
    }

    // ── AI 9 — 미룬 송구 (b4838): 받을 야수.vtc0() ≤ 공 가진 야수.vtb8(루 좌표) 가 되면 0xb2c90(루, 0), 참이면 AI 0 ──
    if (!play.finished && !ballLost && deferredThrowReceiver !== NONE) {
      for (let slot = 0; slot < fielders.length; slot += 1) {
        if (fielders[slot]?.aiState !== AI_STATE.RECEIVE) continue
        const receiver = fielders[deferredThrowReceiver]
        const holder = fielders[play.ballHolderSlot]
        if (receiver === undefined || holder === undefined) continue
        if (fielderArrivalTicks(receiver) > throwTicksTo(holder, basePosition(deferredThrowBase))) continue
        if (sendToBase(tick, deferredThrowBase, ' (AI 9 미룬 송구)', false)) {
          fielders = fielders.map((fielder) =>
            fielder.slot === slot
              ? { ...fielder, aiState: AI_STATE.IDLE, target: FIELDER_START_POSITIONS[slot] ?? fielder.target, targetBase: NONE }
              : fielder,
          )
        }
      }
    }

    // ── 자동 추가 진루 0xaf918 — 경기 장면 슬롯 2 가 매 틱 부른다 (종류 4 는 거르개 2·3·8 밖이다) ──
    if (!play.finished && autoBaserunningEnabled && resultCode === null) {
      const decisions = autoAdvanceDecisions({ ...contextAt(tick), force: true })
      for (const decision of decisions) {
        const runner = runners.find((candidate) => candidate.state.index === decision.runnerIndex)
        if (runner === undefined || runner.state.isOut || runner.state.scored) continue
        if (decision.toBase > HOME_BASE) continue
        // 타구 진행기와 같은 근사 — 목표 루에 닿아 있을 때만 묻는다
        if (!isAtTarget(runner.state)) continue
        runner.state = {
          ...runner.state,
          legStart: runner.state.position,
          startBase: runner.state.targetBase,
          targetBase: decision.toBase,
          settled: false,
        }
        // afa0e: 한 루 더 보내면 플레이+0x128 = 1
        play = { ...play, wantsThrow: true }
        log.push(`${tick}틱 ${runner.state.index}번 주자 자동 진루 → ${decision.toBase}루`)
      }
    }

    // ── CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 매 틱 — `0xae6c8` = 수비 CPU || 송구 자동) ──
    // 견제를 받은 야수도 쥐기 0xb2710 이 +0x128 = 1 을 세우므로, 준비 틱(내야 3)이 지난 틱에 점수식이 루를 고른다
    if (!play.finished && cpuThrowEnabled) cpuThrowDecision(tick)

    // ── 화면 스냅샷 ──
    const flying = flight !== null
    ticks.push(
      viewStateOf({
        tick,
        ball: ballPointAt(
          tick,
          fielders,
          flight ?? { from: play.ballHolderSlot, base: NONE, releaseTick: -1, arrivalTick: -1 },
          targetBase,
        ),
        ballIsFlying: flying,
        fielders,
        runners: runnerStates(),
        catchKind: null,
        chaserSlot: PITCHER_SLOT,
        throwingSlot: tick < 3 ? PITCHER_SLOT : NONE,
        throwBase: flight?.base ?? targetBase,
        previousActions,
        aceIndexes: input.aceIndexes,
        defenseTeamIndex: input.defenseTeamIndex,
        offenseTeamIndex: input.offenseTeamIndex,
      }),
    )

    // ── 한 틱 움직이기 — 커버는 제 루로, 나머지는 제자리 ──
    fielders = fielders.map((fielder) => {
      if (fielder.target === fielder.position) return fielder
      return { ...fielder, position: stepToward(fielder.position, fielder.target, fielder.speed) }
    })
    for (const runner of runners) {
      if (runner.state.isOut || runner.state.scored) continue
      runner.state = {
        ...runner.state,
        position: stepToward(runner.state.position, basePosition(runner.state.targetBase), runner.state.speed),
      }
      if (!isAtTarget(runner.state) || runner.state.settled) continue
      const touched = runner.state.targetBase
      runner.state = { ...runner.state, settled: true, startBase: touched }
      if (wrapBase(touched) === 0 && touched !== 0 && !runner.counted) {
        // ⚠️ 2아웃 득점 보류(state[0])는 타구 진행기 몫이다 — 견제 중 홈인은 자동 진루가 3루 주자를
        // 보낸 경우뿐이라 여기서는 그대로 센다 (근사)
        runner.counted = true
        runner.state = { ...runner.state, scored: true }
        runsScored += 1
        log.push(`${tick}틱 ${runner.state.index}번 주자 홈인`)
      }
    }

    // ── 틱 갱신 뒤 아웃 판정 (0xb43da) ──
    runOutJudgement(tick)

    // ── 결과 메시지 0xbba — 견제사(결과 13) 뒤 0x51d40 이 `아웃 ≤ 2` 면 +0x128 = 1 · 0xafa60 한 번 (사람·CPU 모두) ──
    // 0xafa60 은 공 쥔 야수가 준비(+0xc8 ≤ 0)돼야 고른다. 견제사는 송구를 받는 틱(쥐기가 준비 틱 3 을 막 넣은 틱)이나
    // 돌아오는 주자가 닿는 한두 틱 뒤에 나서 준비가 안 끝나 있다 — 견제 3000판에서 한 번도 고르지 않는다.
    // 준비된 뒤 아웃이 나 점수식이 루를 고르면 위 0xb2c90 · 0xb2e38 로 이어 던진다.
    if (outJudgedThisTick && outs <= 2 && !play.finished) {
      play = { ...play, wantsThrow: true }
      cpuThrowDecision(tick)
    }

    // ── 끝났나 — 결과 코드가 섰거나 송구가 끝났고, 날아가는 공도 뛰는 주자도 없다 ──
    // CPU 송구 결정이 도는 판(`0xae6c8`)은 공 가진 야수가 준비 중이고 +0x128 이 서 있으면 그 틱까지 판을 안 닫는다 —
    // 준비가 끝난 틱의 0xafa60 이 고를 수 있게(타구 진행기 8절과 같은 끝 조건 — 원본 판 끝 0x9d5bd 는 안 옮김, 근사)
    const stillActive = runners.some(
      (runner) => !runner.state.isOut && !runner.state.scored && !isAtTarget(runner.state),
    )
    const holderNow = fielders[play.ballHolderSlot]
    const decisionPending =
      cpuThrowEnabled &&
      play.wantsThrow &&
      play.held &&
      holderNow !== undefined &&
      holderNow.holdingBall &&
      holderNow.actionRemainingTicks > 0
    const receivePending = deferredThrowReceiver !== NONE && fielders.some((fielder) => fielder.aiState === AI_STATE.RECEIVE)
    if ((resultCode !== null || caught) && flight === null && !stillActive && !decisionPending && !receivePending) {
      play = { ...play, finished: true }
    }
  }

  return {
    targetBase,
    resultCode,
    advance: { bases: basesOf(runners), runsScored, outsAdded },
    ticks,
    // 투수가 처음부터 공을 쥐고 시작한다 (0xb28be `P+0x130 = 0`)
    catchFielderSlot: PITCHER_SLOT,
    catchTick: 0,
    isUncatchable: false,
    caughtOnTheFly: false,
    tagOut,
    throwBase: targetBase,
    // 공이 실제로 받는 쪽에 들어간 틱 — 커버를 기다렸으면 추정 도착 틱보다 늦다
    throwArrivalTick: catchTick >= 0 ? catchTick : throwArrivalTick,
    voidedRuns: 0,
    fumbled: false,
    errantThrow,
    specialDefense: { jumpUnlocked: false, slideUnlocked: false },
    laserThrow: false,
    rundowns: 0,
    rundownOuts: 0,
    // 목록 = 찬 루 오름차순, 타자주자 없음 (종류 4 — 위 "상태 0x17 진입" 주석)
    runnerFates: runners.map((runner) => runnerFateOf(runner.state)),
    log,
  }
}

/**
 * 견제가 끝난 뒤의 콜 — 결과 9 면 **늘 17**(0x51c14 의 종류 4·5 갈래), 13 이면 62/20(0x51b36).
 * 견제사는 포스가 걸릴 일이 없어 언제나 태그(결과 3 → state[0x87] = 1)라 사실상 62 다.
 * 결과 코드가 안 섰으면(악송구 근사) 소리도 없다.
 */
export function pickoffCallSoundIdOf(result: Pick<PickoffPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === PICKOFF_RESULT.SAFE) return SAFE_CALL
  if (result.resultCode === PICKOFF_RESULT.OUT) return result.tagOut ? CAUGHT_OUT_CALL : FORCE_OUT_CALL
  return null
}

/** 재생 칸(`lastDefensePlay`)에 든 결과가 견제 판인가 — 타구 결과에는 `resultCode` 가 없다 */
export function isPickoffPlayResult(result: DefensePlayResult | null): result is PickoffPlayResult {
  return result !== null && 'resultCode' in result && 'targetBase' in result
}

const HOME_BASE = 4
/** 0xb2c90: 받는 야수까지 이 거리 이하면 던지지 않는다 */
const MINIMUM_THROW_DISTANCE = 600
const wrapBase = (base: number) => ((base % 4) + 4) % 4

function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

function basesOf(runners: readonly PickoffRunner[]): BaseState {
  let bases = EMPTY_BASES
  for (const runner of runners) {
    if (runner.state.isOut || runner.state.scored) continue
    const base = wrapBase(runner.state.targetBase)
    if (base === 1) bases = { ...bases, first: true }
    if (base === 2) bases = { ...bases, second: true }
    if (base === 3) bases = { ...bases, third: true }
  }
  return bases
}

/** 공 그림 자리 — 던진 야수 손에서 그 루까지 낮은 포물선 (타구 진행기 `ballPointAt` 의 송구 갈래와 같은 근사) */
function ballPointAt(
  tick: number,
  fielders: readonly FielderState[],
  flight: { readonly from: number; readonly base: number; readonly releaseTick: number; readonly arrivalTick: number },
  targetBase: number,
): WorldPoint {
  if (flight.base === NONE) {
    // 날아가는 공이 없다 — 쥔 야수 손 (견제 송구가 빠졌으면 대상 루 자리, 근사)
    const holder = fielders[flight.from]
    return holder?.holdingBall === true ? holder.position : basePosition(targetBase)
  }
  const from = fielders[flight.from]?.position ?? fielders[PITCHER_SLOT].position
  const to = basePosition(flight.base)
  const releaseTick = flight.releaseTick
  const whole = flight.arrivalTick - releaseTick
  if (whole <= 0 || tick >= flight.arrivalTick) return to
  const done = tick - releaseTick
  return {
    x: from.x + Math.trunc(((to.x - from.x) * done) / whole),
    y: Math.trunc((1200 * done * (whole - done)) / (whole * whole)),
    z: from.z + Math.trunc(((to.z - from.z) * done) / whole),
  }
}
