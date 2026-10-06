import type { RandomPort } from '@/shared/api/random/randomPort'
import { PICKOFF_PLAY_KIND, type PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import {
  NO_THROW_ERROR,
  rollThrowError,
} from '@/entities/fielding/model/fieldingErrors'
import {
  basePosition,
  isSamePoint,
  runnerSpeedOf,
  stepToward,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
  createFielders,
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
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import { viewStateOf, type ActionMemory, type DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import { errantArrivalTicks, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
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
 * 악송구면 두 번 더(속도·방향) — 0xa1828 그대로. 그 밖은 없다.
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
 *   `runDefensePlay` 의 `throwMode` 주석). ⚠️ 견제 아웃(결과 13) 뒤 결과 메시지 0xbba 가 부르는 0xafa60 한 번은
 *   이 판이 포구 틱에 끝나서 안 옮겼다.
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
  let receiverSlot = NONE
  /** 공이 받는 쪽 손에 들어갔는가(악송구면 공이 루에 닿은 틱) */
  let caught = false
  let catchTick = -1

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
    tagOut = judged.kind === OUT_KIND.TAG
    resultCode = PICKOFF_RESULT.OUT
    log.push(`${tick}틱 ${victim.state.index}번 주자 견제사 (0xb36d0 결과 ${judged.kind})`)
    const relaxed = releaseForcesAfterOut(runnerStates())
    runners.forEach((runner, index) => {
      runner.state = relaxed[index] ?? runner.state
    })
  }

  for (let tick = 0; tick <= MAXIMUM_TICKS && !play.finished; tick += 1) {
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
      receiverSlot = errantThrow ? NONE : coverSlot
      play = { ...play, wantsThrow: true }
      log.push(
        `${tick}틱 ${targetBase}루 견제 송구 — ${throwArrivalTick}틱 도착` + (errantThrow ? ' (악송구)' : ''),
      )
    }

    // ── 5. 송구 도착 = 포구 (0xb2710 → 0xb36d0, 그리고 0xb4292) ──
    // ⚠️ 근사: 도착 틱 추정(0xbf01c 가 나눗셈을 버림한다)이 커버가 실제로 루를 밟는 틱보다 한 틱 이를 수 있다
    // (2루수 → 2루가 그렇다). 원본은 공이 물리로 날아가 야수에게 닿는 순간 잡으므로, 여기서는 공이 루에 닿은 뒤
    // **커버가 루를 밟는 틱까지 포구를 미룬다** — 받는 쪽이 루 위에 서야 0xb4292 의 "선 루" 가 −1 이 아니다.
    if (!caught && throwArrivalTick >= 0 && tick >= throwArrivalTick) {
      if (receiverSlot === NONE) {
        caught = true
        play = { ...play, wantsThrow: false }
        log.push(`${tick}틱 악송구 — 받은 야수가 없다 (근사)`)
      } else if (isSamePoint(fielders[receiverSlot].position, basePosition(targetBase))) {
        caught = true
        catchTick = tick
        play = { ...play, wantsThrow: false }
        fielders = fielders.map((fielder) =>
          fielder.slot === receiverSlot
            ? { ...fielder, holdingBall: true }
            : fielder.holdingBall
              ? { ...fielder, holdingBall: false }
              : fielder,
        )
        play = { ...play, ballHolderSlot: receiverSlot, held: true }
        runOutJudgement(tick)
        // 0xb4292 — 받은 야수가 선 루(vt0x58: 좌표 완전일치)에 마지막으로 닿은 산 주자가 제 목표점에 있으면 9
        const onBase = runners.find(
          (runner) => !runner.state.isOut && wrapBase(runner.state.startBase) === targetBase,
        )
        if (resultCode === null && onBase !== undefined && isAtTarget(onBase.state)) {
          resultCode = PICKOFF_RESULT.SAFE
          log.push(`${tick}틱 ${targetBase}루 세이프 (결과 9)`)
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
        log.push(`${tick}틱 ${runner.state.index}번 주자 자동 진루 → ${decision.toBase}루`)
      }
    }

    // ── 화면 스냅샷 ──
    const flying = !caught
    ticks.push(
      viewStateOf({
        tick,
        ball: ballPointAt(tick, fielders, targetBase, throwArrivalTick),
        ballIsFlying: flying,
        fielders,
        runners: runnerStates(),
        catchKind: null,
        chaserSlot: PITCHER_SLOT,
        throwingSlot: tick < 3 ? PITCHER_SLOT : NONE,
        throwBase: targetBase,
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

    // ── 끝났나 — 결과 코드가 섰거나, 송구가 끝났고 뛰는 주자가 없다 ──
    const stillActive = runners.some(
      (runner) => !runner.state.isOut && !runner.state.scored && !isAtTarget(runner.state),
    )
    if ((resultCode !== null || caught) && !stillActive) {
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

/** 공 그림 자리 — 투수 손에서 대상 루까지 낮은 포물선 (타구 진행기 `ballPointAt` 의 송구 갈래와 같은 근사) */
function ballPointAt(
  tick: number,
  fielders: readonly FielderState[],
  targetBase: number,
  arrivalTick: number,
): WorldPoint {
  const from = fielders[PITCHER_SLOT].position
  const to = basePosition(targetBase)
  if (arrivalTick <= 0 || tick >= arrivalTick) return to
  return {
    x: from.x + Math.trunc(((to.x - from.x) * tick) / arrivalTick),
    y: Math.trunc((1200 * tick * (arrivalTick - tick)) / (arrivalTick * arrivalTick)),
    z: from.z + Math.trunc(((to.z - from.z) * tick) / arrivalTick),
  }
}
