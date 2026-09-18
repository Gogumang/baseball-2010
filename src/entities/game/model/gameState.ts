import { BALANCE } from '@/shared/config/original/balance'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { advanceRunners, EMPTY_BASES } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'

export const INNINGS_PER_GAME = 9
/** 연장 상한 — 원본에는 상한 코드가 없다(14회에 시뮬레이터 분기만 있음). 끝없는 경기를 막으려 12회로 둔다 (추정) */
export const MAXIMUM_INNINGS = 12
/** 콜드게임 — 7회(이닝 인덱스 > 5) 이후 10점 차 (0xb68fc) */
const COLD_GAME_FROM_INNING = BALANCE.coldGame.fromInning
const COLD_GAME_MARGIN = BALANCE.coldGame.margin
export const BATTING_ORDER_SIZE = 9
export const OUTS_PER_HALF_INNING = 3

/** 타순을 따로 주지 않을 때의 플레이어 타순 칸(3번). 나만의리그는 커리어 타순을 쓴다. */
export const PLAYER_BATTING_ORDER_INDEX = 2

export type InningHalf = '초' | '말'

/** 플레이어 팀은 홈이므로 '말'에 공격한다. */
export interface GameState {
  readonly inning: number
  readonly half: InningHalf
  readonly outs: number
  readonly bases: BaseState
  readonly ourScore: number
  readonly opponentScore: number
  /** 우리 팀 타순 커서. 이닝이 바뀌어도 이어진다. */
  readonly battingOrderIndex: number
  /** 플레이어가 서는 타순 칸 (0 = 1번) */
  readonly playerOrderIndex: number
  readonly isFinished: boolean
}

export function createGame(playerOrderIndex = PLAYER_BATTING_ORDER_INDEX): GameState {
  return {
    inning: 1,
    half: '초',
    outs: 0,
    bases: EMPTY_BASES,
    ourScore: 0,
    opponentScore: 0,
    battingOrderIndex: 0,
    playerOrderIndex,
    isFinished: false,
  }
}

export function isPlayerTurn(game: GameState): boolean {
  return (
    !game.isFinished &&
    game.half === '말' &&
    game.battingOrderIndex === game.playerOrderIndex
  )
}

/** 상대 공격(초)의 득점을 한 번에 반영하고 우리 공격으로 넘긴다. */
export function applyOpponentInning(game: GameState, runs: number): GameState {
  if (game.isFinished || game.half !== '초') return game

  const opponentScore = game.opponentScore + runs
  // 마지막 이닝 이후 초가 끝났을 때 홈팀(우리)이 앞서면 말 없이 끝, 7회 이후 우리가 10점 앞서면 콜드
  const isOver =
    (game.inning >= INNINGS_PER_GAME && game.ourScore > opponentScore) ||
    (game.inning >= COLD_GAME_FROM_INNING && game.ourScore - opponentScore >= COLD_GAME_MARGIN)
  return {
    ...game,
    half: '말',
    outs: 0,
    bases: EMPTY_BASES,
    opponentScore,
    isFinished: isOver,
  }
}

/** 우리 공격(말)에서 타석 하나의 결과를 반영한다. 3아웃이면 이닝을 넘긴다. */
export function applyAtBatOutcome(game: GameState, outcome: AtBatOutcome): GameState {
  if (game.isFinished || game.half !== '말') return game

  const advance = advanceRunners(game.bases, outcome, game.outs)
  const outs = game.outs + advance.outsAdded
  const afterAtBat: GameState = {
    ...game,
    outs,
    bases: advance.bases,
    ourScore: game.ourScore + advance.runsScored,
    battingOrderIndex: (game.battingOrderIndex + 1) % BATTING_ORDER_SIZE,
  }

  // 마지막 이닝 이후 말 공격 중 앞서는 순간 끝난다 (끝내기)
  const isWalkOff = game.inning >= INNINGS_PER_GAME && afterAtBat.ourScore > afterAtBat.opponentScore
  if (isWalkOff) return { ...afterAtBat, isFinished: true }
  // 콜드게임은 말 공격 중에는 **아웃 수와 무관하게 타석마다** 본다 (0xb6976 — 직접 디스어셈해 확인).
  // 원본은 공격 중인 팀이 10점 차로 달아나는 순간 바로 끝낸다. 3아웃까지 기다리지 않는다.
  if (isColdGame(afterAtBat)) return { ...afterAtBat, isFinished: true }
  return outs >= OUTS_PER_HALF_INNING ? endOurInning(afterAtBat) : afterAtBat
}

/** 7회 이후 우리가 10점 앞서 있는가 (0xb6976). 공격 중이면 매 타석 본다 */
function isColdGame(game: GameState): boolean {
  return game.inning >= COLD_GAME_FROM_INNING && game.ourScore - game.opponentScore >= COLD_GAME_MARGIN
}

/** 말 3아웃 — 마지막 이닝 이후 동점이 아니면 끝, 동점이면 연장(상한 12회, 추정). 7회 이후 상대가 10점 앞서면 콜드 */
function endOurInning(game: GameState): GameState {
  const isTied = game.ourScore === game.opponentScore
  const isLastInning =
    (game.inning >= INNINGS_PER_GAME && (!isTied || game.inning >= MAXIMUM_INNINGS)) ||
    (game.inning >= COLD_GAME_FROM_INNING && game.opponentScore - game.ourScore >= COLD_GAME_MARGIN)

  return {
    ...game,
    inning: isLastInning ? game.inning : game.inning + 1,
    half: '초',
    outs: 0,
    bases: EMPTY_BASES,
    isFinished: isLastInning,
  }
}

export type GameResult = '승' | '무' | '패'

export function resultOf(game: GameState): GameResult {
  if (game.ourScore > game.opponentScore) return '승'
  if (game.ourScore < game.opponentScore) return '패'
  return '무'
}
