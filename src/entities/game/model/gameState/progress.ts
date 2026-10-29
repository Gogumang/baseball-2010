import type { AtBatOutcome } from '@/entities/game/model/gameState/otherSlices'
import { advanceRunners, EMPTY_BASES, type AdvanceResult, type BaseState } from '@/entities/game/model/baseState'
import { EMPTY_BASE_RUNNERS, effectiveRunnersOf, runnersAfterPlay, survivorsWithoutPlayOf, type BaseRunners } from '@/entities/game/model/baseRunners'
import { endSituationOf, isGameOverAt } from '@/entities/game/model/gameState/gameEnd'
import { halfSideOf, withFinalOffenseSide, withInningRuns } from '@/entities/game/model/gameState/inningRuns'
import { opponentHalfOf, ourHalfOf } from '@/entities/game/model/gameState/sides'
import { BATTING_ORDER_SIZE, OUTS_PER_HALF_INNING, type GameState, type RunnerHint } from '@/entities/game/model/gameState/types'

/**
 * 상대 공격 한 이닝의 득점을 한 번에 반영하고 우리 공격으로 넘긴다.
 * **상대가 공격하는 반 이닝은 측이 정한다** — 사람이 후공(측 1)이면 초, 선공(측 0)이면 말이다.
 */
export function applyOpponentInning(game: GameState, runs: number): GameState {
  if (game.isFinished || game.half !== opponentHalfOf(game)) return game

  const scored: GameState = withInningRuns({ ...game, opponentScore: game.opponentScore + runs }, 1 - game.playerSide, runs)
  return game.half === '초' ? endTopHalf(scored) : endBottomHalf(scored)
}

/**
 * 우리 공격에서 타석 하나의 결과를 반영한다. 3아웃이면 반 이닝을 넘긴다.
 * **우리가 공격하는 반 이닝은 측이 정한다** (측 0 선공 = 초 · 측 1 후공 = 말).
 *
 * `precomputed` 를 주면 주자 처리를 그 결과로 대신한다 — 사람 경기에서 수비 시뮬레이션
 * (`features/defense-play`)이 정한 아웃·득점·루 상황을 그대로 넣는 자리다.
 * 안 주면 지금까지처럼 `baseState.advanceRunners` 의 근사를 쓴다 (미션·투수편이 그 길을 쓴다).
 */
export function applyAtBatOutcome(
  game: GameState,
  outcome: AtBatOutcome,
  precomputed?: AdvanceResult,
  /**
   * 주자 신원 — 간이 타석처럼 이미 셈한 신원(`runners`)이나, 수비 진행기 판의 살아남은 주자(`survivorsFromBase`).
   * 안 주면 결과 종류로 타자가 나갔는지 보고 앞선 주자부터 앉힌다(`runnersAfterPlay`).
   */
  runnerHint?: RunnerHint,
): GameState {
  if (game.isFinished || game.half !== ourHalfOf(game)) return game

  const advance = precomputed ?? advanceRunners(game.bases, outcome, game.outs)
  const outs = game.outs + advance.outsAdded
  const runners = runnerHint?.runners ?? runnersAfterAtBat(game, outcome, advance, runnerHint)
  const afterAtBat: GameState = withInningRuns(
    {
      ...game,
      outs,
      bases: advance.bases,
      runners,
      ourScore: game.ourScore + advance.runsScored,
      battingOrderIndex: (game.battingOrderIndex + 1) % BATTING_ORDER_SIZE,
    },
    game.playerSide,
    advance.runsScored,
  )

  // 타석마다 경기 끝 판정 0xb68fc (`isGameOverAt`) — 3아웃 전에는 말 공격 중의 끝내기(9회 이후 홈 > 원정)와
  // 콜드(7회 이후 홈 ≥ 원정 + 10)만 선다. 초 공격 중에는 원정이 10점 앞서도 끝나지 않는다(b696e) — 예전 웹은 공격 중인
  // 우리가 10점 앞서면 초에도 끝냈다. 3아웃이면 아래 반 이닝 넘김이 같은 판정을 아웃 3 으로 본다
  if (outs < OUTS_PER_HALF_INNING) return withWalkOffCheck(afterAtBat, game.half)
  return game.half === '초' ? endTopHalf(afterAtBat) : endBottomHalf(afterAtBat)
}

/** 3아웃 전 타석 뒤 0xb68fc — 끝이면 그 반 이닝의 공격 측을 남기고 끝낸다 */
function withWalkOffCheck(afterAtBat: GameState, half: GameState['half']): GameState {
  if (!isGameOverAt(endSituationOf(afterAtBat))) return afterAtBat
  return withFinalOffenseSide({ ...afterAtBat, isFinished: true }, halfSideOf(half))
}

/** 타자가 루에 나간 결과인가 — 안타 · 볼넷 · 사구 */
const isBatterReachedKind = (kind: AtBatOutcome['kind']) => kind === '안타' || kind === '볼넷' || kind === '사구'

/** 결과 종류로 타자가 나갔는지 보고 앞선 주자부터 앉힌 신원 (`runnersAfterPlay`) */
function runnersAfterAtBat(game: GameState, outcome: AtBatOutcome, advance: AdvanceResult, runnerHint: RunnerHint | undefined): BaseRunners {
  return runnersAfterPlay(runnersOfGame(game), advance.bases, {
    batter: battingSlotOf(game.battingOrderIndex),
    batterReached: isBatterReachedKind(outcome.kind),
    runsScored: advance.runsScored,
    ...survivorsOf(game.bases, outcome, runnerHint),
  })
}

/**
 * 신원을 앉힐 살아남은 주자 — 넘겨받은 운명(`survivorsFromBase`)이 없고 결과 코드를 넘겨받지 않았으면(`precomputed` 없이 온 결과도
 * 같다) 진행기를 안 도는 결과(삼진 · 볼넷 · 사구 · 홈런)의 정산 목록(`survivorsWithoutPlayOf`)으로. 주자만 움직인 판의 자리표
 * 결과는 늘 운명을 싣는다.
 */
function survivorsOf(
  bases: BaseState,
  outcome: AtBatOutcome,
  runnerHint: RunnerHint | undefined,
): { readonly survivorsFromBase?: readonly number[] } {
  if (runnerHint?.survivorsFromBase !== undefined) return { survivorsFromBase: runnerHint.survivorsFromBase }
  const survivors = survivorsWithoutPlayOf(bases, outcome.kind)
  return survivors === null ? {} : { survivorsFromBase: survivors }
}

/** 타순 커서 → 타순 칸 (0~8) */
function battingSlotOf(order: number): number {
  return ((order % BATTING_ORDER_SIZE) + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE
}

/**
 * 지금 루에 선 주자의 신원(공격 팀 타순 칸) — 들고 있는 신원이 루 상황과 맞으면 그것, 아니면 예전 근사(지금 타순 커서에서
 * 거꾸로 b 번째가 b 루). 투수편 거울(`pitcherGameState`)처럼 상대 공격이면 `order` 에 상대 타순 커서를 넘긴다.
 */
export function runnersOfGame(game: GameState, order = game.battingOrderIndex): BaseRunners {
  return effectiveRunnersOf(game.bases, game.runners, (ordersBack) => battingSlotOf(order - ordersBack))
}

/**
 * 초가 끝났다 — 0xb68fc 를 아웃 3 으로: 마지막 이닝 이후 홈팀이 앞서면 말 공격 없이 끝난다.
 * 7회 이후 홈팀이 10점 앞서 있으면 콜드다. (측과 무관하게 홈·원정 점수로 본다)
 */
function endTopHalf(game: GameState): GameState {
  const isOver = isGameOverAt(endSituationOf(game, OUTS_PER_HALF_INNING))

  return withFinalOffenseSide({ ...game, half: '말', outs: 0, bases: EMPTY_BASES, runners: EMPTY_BASE_RUNNERS, isFinished: isOver }, 0)
}

/**
 * 말 3아웃 — 0xb68fc 를 아웃 3 으로: 마지막 이닝 이후 동점이 아니면 끝, 동점이면 상한 없이 연장(0xb6934).
 * 7회 이후 어느 쪽이든 10점 앞서면 콜드(b6962 원정 · b6976 홈 — 상대가 홈이면 그 반 이닝 끝에 홈 10점 차도 끝이다)
 */
function endBottomHalf(game: GameState): GameState {
  const isLastInning = isGameOverAt(endSituationOf(game, OUTS_PER_HALF_INNING))

  return withFinalOffenseSide(
    {
      ...game,
      inning: isLastInning ? game.inning : game.inning + 1,
      half: '초',
      outs: 0,
      bases: EMPTY_BASES,
      runners: EMPTY_BASE_RUNNERS,
      isFinished: isLastInning,
    },
    1,
  )
}
