import { EMPTY_BASES } from '@/entities/game/model/baseState'
import {
  PLAYER_BATTING_ORDER_INDEX,
  PLAYER_SIDE_FIRST_BAT,
  PLAYER_SIDE_LAST_BAT,
  type GameResult,
  type GameState,
  type InningHalf,
  type PlayerSide,
} from '@/entities/game/model/gameState/types'

export function createGame(playerOrderIndex = PLAYER_BATTING_ORDER_INDEX, playerSide: PlayerSide = PLAYER_SIDE_LAST_BAT): GameState {
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

export function isPlayerTurn(game: GameState): boolean {
  return !game.isFinished && game.half === ourHalfOf(game) && game.battingOrderIndex === game.playerOrderIndex
}

export function resultOf(game: GameState): GameResult {
  if (game.ourScore > game.opponentScore) return '승'
  if (game.ourScore < game.opponentScore) return '패'
  return '무'
}
