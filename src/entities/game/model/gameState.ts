import { BALANCE } from '@/shared/config/original/balance'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { advanceRunners, EMPTY_BASES } from '@/entities/game/model/baseState'
import type { AdvanceResult, BaseState } from '@/entities/game/model/baseState'

export const INNINGS_PER_GAME = 9
/**
 * **원본에는 연장 상한이 없다** (E 3d 확정) — 동점이면 점수가 갈릴 때까지 돈다.
 * 14회 분기는 상한이 아니라 "15회에 스윙 강제"(0xc26e0, 0-기준 0xe)였다.
 * 여기 값은 끝없는 경기를 막는 **우리 쪽 안전망**이라 원본 동작이 아니다.
 */
export const MAXIMUM_INNINGS = 30
/** 콜드게임 — 7회(이닝 인덱스 > 5) 이후 10점 차 (0xb68fc) */
const COLD_GAME_FROM_INNING = BALANCE.coldGame.fromInning
const COLD_GAME_MARGIN = BALANCE.coldGame.margin
export const BATTING_ORDER_SIZE = 9
export const OUTS_PER_HALF_INNING = 3

/** 타순을 따로 주지 않을 때의 플레이어 타순 칸(3번). 나만의리그는 커리어 타순을 쓴다. */
export const PLAYER_BATTING_ORDER_INDEX = 2

export type InningHalf = '초' | '말'

/**
 * 사람이 맡는 측 — 원본 설정 레코드 `+8` 이 정한다 (0x30f44·0x30f50 이 읽고, `state[0x31+측] = 0` 으로 적는다).
 * 경기 상태 초기화 `0xb6814` 가 `state[9] = 0`(공격) · `state[0xa] = 1`(수비) 로 시작하므로
 * **측 0 = 1회 초 공격 = 선공** · **측 1 = 후공(홈)** 이다.
 *
 * 일반모드는 이 칸이 **반반**이고(빠른실행 `0x3123c` 가 `bfa54(0,2) != 0`), **대전모드만 늘 측 1**
 * 로 박혀 있다(`0x30c86` 이 `rec[8] = 1` 을 되써 넣는다).
 * 나만의리그는 지금까지 늘 후공으로 돌려 왔으므로 **기본값**만 측 1 로 두고 박아 두지는 않는다.
 */
export type PlayerSide = 0 | 1
/** 측 0 — 사람이 선공(초에 공격) */
export const PLAYER_SIDE_FIRST_BAT: PlayerSide = 0
/** 측 1 — 사람이 후공(말에 공격, 홈) */
export const PLAYER_SIDE_LAST_BAT: PlayerSide = 1

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
  /** 사람이 맡는 측 (0 선공 · 1 후공) — 원본 설정 레코드 +8 */
  readonly playerSide: PlayerSide
  readonly isFinished: boolean
}

export function createGame(
  playerOrderIndex = PLAYER_BATTING_ORDER_INDEX,
  playerSide: PlayerSide = PLAYER_SIDE_LAST_BAT,
): GameState {
  return {
    inning: 1,
    half: '초',
    outs: 0,
    bases: EMPTY_BASES,
    ourScore: 0,
    opponentScore: 0,
    battingOrderIndex: 0,
    playerOrderIndex,
    playerSide,
    isFinished: false,
  }
}

/** 우리가 공격하는 반 이닝 — 측 0 이면 초, 측 1 이면 말 */
export function ourHalfOf(game: GameState): InningHalf {
  return game.playerSide === PLAYER_SIDE_FIRST_BAT ? '초' : '말'
}

/** 상대가 공격하는 반 이닝 */
export function opponentHalfOf(game: GameState): InningHalf {
  return game.playerSide === PLAYER_SIDE_FIRST_BAT ? '말' : '초'
}

/** 홈(말 공격) 팀 점수 — 측 1 이면 우리, 측 0 이면 상대다 */
function homeScoreOf(game: GameState): number {
  return game.playerSide === PLAYER_SIDE_LAST_BAT ? game.ourScore : game.opponentScore
}

/** 원정(초 공격) 팀 점수 */
function awayScoreOf(game: GameState): number {
  return game.playerSide === PLAYER_SIDE_LAST_BAT ? game.opponentScore : game.ourScore
}

export function isPlayerTurn(game: GameState): boolean {
  return (
    !game.isFinished &&
    game.half === ourHalfOf(game) &&
    game.battingOrderIndex === game.playerOrderIndex
  )
}

/**
 * 상대 공격 한 이닝의 득점을 한 번에 반영하고 우리 공격으로 넘긴다.
 * **상대가 공격하는 반 이닝은 측이 정한다** — 사람이 후공(측 1)이면 초, 선공(측 0)이면 말이다.
 */
export function applyOpponentInning(game: GameState, runs: number): GameState {
  if (game.isFinished || game.half !== opponentHalfOf(game)) return game

  const scored: GameState = { ...game, opponentScore: game.opponentScore + runs }
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
): GameState {
  if (game.isFinished || game.half !== ourHalfOf(game)) return game

  const advance = precomputed ?? advanceRunners(game.bases, outcome, game.outs)
  const outs = game.outs + advance.outsAdded
  const afterAtBat: GameState = {
    ...game,
    outs,
    bases: advance.bases,
    ourScore: game.ourScore + advance.runsScored,
    battingOrderIndex: (game.battingOrderIndex + 1) % BATTING_ORDER_SIZE,
  }

  // 끝내기 — **말 공격 중인 홈팀**이 마지막 이닝 이후 앞서는 순간 끝난다.
  // 사람이 선공(측 0)이면 우리 공격은 초라 끝내기가 성립하지 않는다.
  const isWalkOff =
    game.half === '말' &&
    game.inning >= INNINGS_PER_GAME &&
    homeScoreOf(afterAtBat) > awayScoreOf(afterAtBat)
  if (isWalkOff) return { ...afterAtBat, isFinished: true }
  // 콜드게임은 공격 중에는 **아웃 수와 무관하게 타석마다** 본다 (0xb6976 — 직접 디스어셈해 확인).
  // 원본은 공격 중인 팀이 10점 차로 달아나는 순간 바로 끝낸다. 3아웃까지 기다리지 않는다.
  if (isColdGame(afterAtBat)) return { ...afterAtBat, isFinished: true }
  if (outs < OUTS_PER_HALF_INNING) return afterAtBat
  return game.half === '초' ? endTopHalf(afterAtBat) : endBottomHalf(afterAtBat)
}

/** 7회 이후 **공격 중인 우리**가 10점 앞서 있는가 (0xb6976). 공격 중이면 매 타석 본다 */
function isColdGame(game: GameState): boolean {
  return game.inning >= COLD_GAME_FROM_INNING && game.ourScore - game.opponentScore >= COLD_GAME_MARGIN
}

/**
 * 초가 끝났다 — 마지막 이닝 이후 홈팀이 앞서면 말 공격 없이 끝난다.
 * 7회 이후 홈팀이 10점 앞서 있으면 콜드다. (측과 무관하게 홈·원정 점수로 본다)
 */
function endTopHalf(game: GameState): GameState {
  const home = homeScoreOf(game)
  const away = awayScoreOf(game)
  const isOver =
    (game.inning >= INNINGS_PER_GAME && home > away) ||
    (game.inning >= COLD_GAME_FROM_INNING && home - away >= COLD_GAME_MARGIN)

  return { ...game, half: '말', outs: 0, bases: EMPTY_BASES, isFinished: isOver }
}

/** 말 3아웃 — 마지막 이닝 이후 동점이 아니면 끝, 동점이면 연장(상한은 우리 쪽 안전망). 7회 이후 원정팀이 10점 앞서면 콜드 */
function endBottomHalf(game: GameState): GameState {
  const isTied = game.ourScore === game.opponentScore
  const isLastInning =
    (game.inning >= INNINGS_PER_GAME && (!isTied || game.inning >= MAXIMUM_INNINGS)) ||
    (game.inning >= COLD_GAME_FROM_INNING && awayScoreOf(game) - homeScoreOf(game) >= COLD_GAME_MARGIN)

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
