import { describe, expect, it } from 'vitest'
import {
  PLAYER_SIDE_FIRST_BAT,
  PLAYER_SIDE_LAST_BAT,
  createGame,
  opponentHalfOf,
} from '@/entities/game/model/gameState'
import type { GameState } from '@/entities/game/model/gameState'
import {
  INNING_RUN_SLOTS,
  addInningRuns,
  applyOpponentAtBat,
  clearInningRuns,
  inningRunsOf,
} from '@/features/play-pitcher-game/model/pitcherGameState'

/** 사람이 후공(측 1)이면 상대는 초에 공격한다 */
const 후공경기 = (): GameState => createGame(-1, PLAYER_SIDE_LAST_BAT)
/** 사람이 선공(측 0)이면 상대는 말에 공격한다 */
const 선공경기 = (): GameState => createGame(-1, PLAYER_SIDE_FIRST_BAT)

describe('수비 반 이닝의 타석 하나', () => {
  it('상대 득점은 상대 점수 칸으로 간다 — 우리 점수는 그대로다', () => {
    const 결과 = applyOpponentAtBat(후공경기(), 0, { kind: '홈런' })

    expect(결과.game.opponentScore).toBe(1)
    expect(결과.game.ourScore).toBe(0)
    expect(결과.runsScored).toBe(1)
  })

  it('상대 타순만 돌고 우리 타순·측은 그대로 남는다', () => {
    const 결과 = applyOpponentAtBat(후공경기(), 5, { kind: '삼진' })

    expect(결과.opponentOrderIndex).toBe(6)
    expect(결과.game.battingOrderIndex).toBe(0)
    expect(결과.game.playerSide).toBe(PLAYER_SIDE_LAST_BAT)
    expect(결과.game.playerOrderIndex).toBe(-1)
  })

  it('3아웃이면 반 이닝이 넘어간다', () => {
    let game = 후공경기()
    for (let out = 0; out < 3; out += 1) {
      const 결과 = applyOpponentAtBat(game, 0, { kind: '아웃', detail: '땅볼아웃' })
      game = 결과.game
    }

    expect(game.half).toBe('말')
    expect(game.outs).toBe(0)
  })

  it('우리 공격 반 이닝에는 아무 일도 하지 않는다', () => {
    const 말 = { ...후공경기(), half: '말' as const }
    const 결과 = applyOpponentAtBat(말, 0, { kind: '홈런' })

    expect(결과.game).toBe(말)
    expect(결과.runsScored).toBe(0)
  })

  it('사람이 선공이면 상대가 홈팀이라 9회말 역전에 경기가 끝난다 (끝내기)', () => {
    const 경기: GameState = { ...선공경기(), inning: 9, half: '말', ourScore: 0, opponentScore: 0 }
    expect(경기.half).toBe(opponentHalfOf(경기))

    const 결과 = applyOpponentAtBat(경기, 0, { kind: '홈런' })

    expect(결과.game.isFinished).toBe(true)
    expect(결과.game.opponentScore).toBe(1)
  })
})

describe('이닝별 실점 표 (0xb6988)', () => {
  it('이닝 칸에 쌓이고 그 칸만 읽힌다', () => {
    const 표 = addInningRuns(addInningRuns([], 3, 2), 5, 1)

    expect(inningRunsOf(표, 3)).toBe(2)
    expect(inningRunsOf(표, 5)).toBe(1)
    expect(inningRunsOf(표, 1)).toBe(0)
  })

  it('⚠️ 원본대로 칸이 9개뿐이라 연장 10회는 1회 칸에 덧쌓인다', () => {
    const 표 = addInningRuns(addInningRuns([], 1, 3), 10, 2)

    expect(INNING_RUN_SLOTS).toBe(9)
    expect(inningRunsOf(표, 10)).toBe(5)
  })

  it('이닝이 바뀌면 그 칸을 비운다', () => {
    const 표 = clearInningRuns(addInningRuns([], 4, 7), 4)

    expect(inningRunsOf(표, 4)).toBe(0)
  })
})
