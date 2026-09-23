import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import {
  basePosition,
  horizontalDistance,
  isSamePoint,
  stepToward,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  createRunner,
  NONE,
  type FielderState,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { EMPTY_BASES, runnerCountOf, type BaseState } from '@/entities/game/model/baseState'
import {
  aceIndexesWithOriginalBug,
  viewStateOf,
  type ActionMemory,
  type DefensePlayView,
} from '@/features/defense-play/model/defensePlayView'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * 홈런 **비행 전용 재생**.
 *
 * 원본은 타구가 뜨면 홈런이라도 경기 장면이 상태 0x17(수비 인플레이)로 넘어가 공이 멈출 때까지
 * 같은 루프를 돈다 (R10 · I 문서). 그런데 우리 진행기(`runDefensePlay`)는 **타자주자의 운명을
 * 결과 코드가 정하는** 구조라, 홈런에 그것을 돌리면 진루·득점이 두 군데서 정해져 어긋난다.
 * 그래서 홈런은 **아무도 잡지 못하는 타구**라는 점만 살려 "보여 줄 틱" 만 따로 만든다 —
 * 아웃·득점·루 상황은 지금까지처럼 타석 쪽(`applyAtBatOutcome`)이 정한다.
 *
 * 공은 담장을 넘어가고(궤적이 담장 틱에서 끝난다 — 공 +0xaa4), 야수는 그 공을 쫓다가
 * 넘어가는 것을 보고 멈춘다. 주자는 타자주자를 포함해 **모두 홈까지** 돈다.
 */

/** 기본 능력치 — `runDefensePlay` 와 같은 값(원본 평균대, 등급 3) */
const DEFAULT_ABILITY = 500

/**
 * 홈런 구보 속도(틱당). **근사다.**
 *
 * 원본 주자 속도는 `runnerSpeedOf(500) = 335` 라 네 루를 도는 데 95 틱쯤 걸리는데,
 * 그러면 다른 타구 재생(땅볼 31 · 뜬공 37~45 · 3루타 72틱)보다 한참 길어 지루해진다.
 * 그래서 홈런 세리머니 구보만 조금 빠르게 잡아 전체가 70틱대에 들어오게 했다 —
 * 원본에서 읽은 값이 아니다.
 */
export const HOME_RUN_TROT_SPEED = 450

/** 홈을 가리키는 루 번호 — 원본 루 표의 [4] 가 홈의 사본이라 진루는 4 로 센다 */
const HOME_BASE = 4

/** 재생이 이 틱을 넘기면 끊는다 (원본에는 없는 우리 쪽 안전망) */
const MAXIMUM_TICKS = 160

export interface HomeRunPlaybackInput {
  /** 타석 결과. 홈런이 아니면 재생할 것이 없다 */
  readonly outcome: AtBatOutcome
  /** 투구 때의 루 상황 — 이 주자들도 함께 홈까지 돈다 */
  readonly bases: BaseState
  /** 원본 패턴. 안 주면 홈런 대표 패턴을 고른다 (비거리 27000 목표) */
  readonly pattern?: BattedBallPattern
  /** 수비 9명의 수비 능력치 (칸 순서). 기본 500 — 여기서는 시작 자리를 만드는 데만 쓰인다 */
  readonly defenseAbilities?: readonly number[]

  // ── 아래 셋은 **그림에만 쓰인다**. 안 주면 지금까지와 똑같다 (`runDefensePlay` 와 같은 칸들) ──

  /**
   * 수비 칸별 **마선수 번호 0~4** (마선수가 아닌 칸은 null·undefined) — R3 7-1 · C-16.
   * 칸 0(투수)은 투수 마선수 표 0xd4008, 나머지는 타자 마선수 표 0xd3f10 이다.
   *
   * ⚠️ 타자 마선수 그림은 원본이 **팀당 첫 한 명만** 적재하므로 둘째부터도 첫째 그림으로 나온다.
   * 그 버그를 되살리는 것은 **부르는 쪽 몫**이라(`viewStateOf` 는 표를 그대로 넘긴다)
   * 여기서 `aceIndexesWithOriginalBug` 를 한 번 통과시켜 넘긴다 (R3 7-3).
   */
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 팀 번호 0~14 — 야수 그림 팔레트 `defender.mpl` (C-1, 15색) */
  readonly defenseTeamIndex?: number
  /** 공격 팀 번호 0~14 — 주자 그림 팔레트 */
  readonly offenseTeamIndex?: number
}

interface TrotRunner {
  state: RunnerState
}

/**
 * 홈런이면 재생할 틱을 만든다. 홈런이 아니면 null.
 *
 * ⚠️ 되돌려 주는 `advance` 는 **화면용 껍데기**다 — 홈런의 점수 계산은 타석 쪽이 이미 맞게 하고
 * 있으므로 경기 진행기는 이 값을 쓰지 않는다 (`lastDefensePlay` 로만 들어간다).
 */
export function homeRunPlaybackOf(input: HomeRunPlaybackInput): DefensePlayResult | null {
  if (input.outcome.kind !== '홈런') return null

  const trajectory = battedBallTrajectory(input.pattern ?? representativePatternOf(input.outcome))
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  let fielders = createFielders(abilities)

  // 공이 사라지는 틱 — 담장을 넘으면 궤적이 거기서 끝난다. 넘지 못한 패턴이면 궤적 끝을 쓴다
  const lastBallTick = trajectory.fenceTick >= 0 ? trajectory.fenceTick : trajectory.length - 1
  const chaserSlot = nearestFielderSlot(fielders, trajectory.pointAt(lastBallTick))

  const runners = createTrotRunners(input.bases)
  const ticks: DefensePlayView[] = []
  const previousActions: ActionMemory = new Map()

  // 마선수 표는 매 틱 같으므로 한 번만 뭉개 둔다 (원본 버그 — R3 7-3)
  const aceIndexes = aceIndexesWithOriginalBug(input.aceIndexes)

  const snapshotAt = (tick: number): DefensePlayView =>
    viewStateOf({
      tick,
      ball: trajectory.pointAt(Math.min(tick, lastBallTick)),
      // 담장을 넘어간 공은 끝까지 "떠 있는" 공이다 — 이 타구는 땅에 닿지 않는다
      ballIsFlying: true,
      fielders,
      runners: runners.map((runner) => runner.state),
      catchKind: null,
      chaserSlot,
      throwingSlot: NONE,
      throwBase: NONE,
      previousActions,
      // ── 그림에만 쓰이는 것들 ──
      // 홈런 재생에는 레이저 반짝임이 없다 — 공을 쥔 야수가 없으니 0x43406 의 첫 조건이 안 선다
      aceIndexes,
      defenseTeamIndex: input.defenseTeamIndex,
      offenseTeamIndex: input.offenseTeamIndex,
    })

  for (let tick = 0; tick <= MAXIMUM_TICKS; tick += 1) {
    const ball = trajectory.pointAt(Math.min(tick, lastBallTick))

    ticks.push(snapshotAt(tick))

    // 공이 넘어갈 때까지만 쫓는다 — 넘어간 뒤에는 그 자리에 서서 본다 (절대 잡지 못한다)
    fielders = fielders.map((fielder) =>
      fielder.slot === chaserSlot && tick < lastBallTick
        ? {
            ...fielder,
            target: ball,
            position: stepToward(fielder.position, ball, fielder.speed),
            aiState: AI_STATE.CHASE,
          }
        : fielder,
    )

    for (const runner of runners) {
      if (runner.state.scored) continue
      const target = basePosition(runner.state.targetBase)
      runner.state = {
        ...runner.state,
        position: stepToward(runner.state.position, target, runner.state.speed),
      }
      if (!isSamePoint(runner.state.position, target)) continue
      if (runner.state.targetBase < HOME_BASE) {
        // 한 루씩 이어 달린다 — 출발점·출발 루를 새로 잡아야 진행률이 맞는다
        runner.state = {
          ...runner.state,
          legStart: runner.state.position,
          startBase: runner.state.targetBase,
          targetBase: runner.state.targetBase + 1,
          settled: false,
        }
        continue
      }
      runner.state = { ...runner.state, scored: true, settled: true }
    }

    const allHome = runners.every((runner) => runner.state.scored)
    if (allHome && tick >= lastBallTick) {
      // 마지막 한 장은 **움직인 뒤**를 찍는다 — 안 그러면 홈을 한 걸음 남긴 그림에서 재생이 끝난다
      ticks.push(snapshotAt(tick + 1))
      break
    }
  }

  return {
    // ⚠️ 화면용 껍데기 — 홈런의 진루·득점은 타석 쪽이 정한다. 여기 값은 아무도 읽지 않는다
    advance: { bases: EMPTY_BASES, runsScored: runnerCountOf(input.bases) + 1, outsAdded: 0 },
    ticks,
    catchFielderSlot: chaserSlot,
    // 아무도 잡지 못했다 — 포구 틱이 없다
    catchTick: -1,
    isUncatchable: true,
    caughtOnTheFly: false,
    throwBase: NONE,
    throwArrivalTick: -1,
    voidedRuns: 0,
    fumbled: false,
    errantThrow: false,
    specialDefense: { jumpUnlocked: false, slideUnlocked: false },
    laserThrow: false,
    log: [`홈런 — ${lastBallTick}틱에 담장을 넘었다 (${ticks.length}틱 재생)`],
  }
}

/** 타자주자 + 루에 있던 주자. 모두 홈(4루)까지 간다 */
function createTrotRunners(bases: BaseState): TrotRunner[] {
  const runners: TrotRunner[] = []
  const push = (fromBase: number) => {
    const index = runners.length
    runners.push({
      state: createRunner(index, fromBase, HOME_RUN_TROT_SPEED, {
        targetBase: fromBase + 1,
        isBatterRunner: index === 0,
      }),
    })
  }
  // 0 = 타자주자. 그 뒤는 `runDefensePlay` 와 같은 차례(뒤 주자 → 앞선 주자)
  push(0)
  if (bases.first) push(1)
  if (bases.second) push(2)
  if (bases.third) push(3)
  return runners
}

/** 공이 사라지는 지점에 가장 가까운 야수 — 그 사람이 쫓는다 */
function nearestFielderSlot(fielders: readonly FielderState[], point: WorldPoint): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (const fielder of fielders) {
    const distance = horizontalDistance(fielder.position, point)
    if (distance >= bestDistance) continue
    bestDistance = distance
    best = fielder.slot
  }
  return best
}
