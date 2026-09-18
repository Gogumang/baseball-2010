import { describe, expect, it } from 'vitest'
import {
  applyAtBatOutcome,
  applyOpponentInning,
  createGame,
  INNINGS_PER_GAME,
  MAXIMUM_INNINGS,
  isPlayerTurn,
  PLAYER_BATTING_ORDER_INDEX,
  resultOf,
} from '@/entities/game/model/gameState'
import type { GameState } from '@/entities/game/model/gameState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

const 땅볼아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }

function 우리공격상태(overrides: Partial<GameState> = {}): GameState {
  return { ...applyOpponentInning(createGame(), 0), ...overrides }
}

describe('createGame', () => {
  it('1회초 0대 0으로 시작한다', () => {
    const game = createGame()

    expect(game.inning).toBe(1)
    expect(game.half).toBe('초')
    expect(game.ourScore).toBe(0)
    expect(game.opponentScore).toBe(0)
    expect(game.isFinished).toBe(false)
  })

  it('상대 공격 중에는 플레이어 차례가 아니다', () => {
    expect(isPlayerTurn(createGame())).toBe(false)
  })
})

describe('applyOpponentInning', () => {
  it('상대 득점을 반영하고 우리 공격으로 넘어간다', () => {
    const game = applyOpponentInning(createGame(), 2)

    expect(game.opponentScore).toBe(2)
    expect(game.half).toBe('말')
    expect(game.outs).toBe(0)
  })

  it('우리 공격 중에 부르면 아무것도 바꾸지 않는다', () => {
    const 우리공격 = applyOpponentInning(createGame(), 0)

    expect(applyOpponentInning(우리공격, 3)).toBe(우리공격)
  })
})

describe('applyAtBatOutcome', () => {
  it('타순이 한 칸 넘어간다', () => {
    const game = applyAtBatOutcome(우리공격상태(), 땅볼아웃)

    expect(game.battingOrderIndex).toBe(1)
  })

  it('타순은 9번을 지나면 1번으로 돌아온다', () => {
    const game = applyAtBatOutcome(우리공격상태({ battingOrderIndex: 8 }), { kind: '볼넷' })

    expect(game.battingOrderIndex).toBe(0)
  })

  it('3아웃이면 이닝이 넘어가고 주자와 아웃이 초기화된다', () => {
    const 이아웃만루 = 우리공격상태({
      outs: 2,
      bases: { first: true, second: true, third: true },
    })

    const game = applyAtBatOutcome(이아웃만루, 땅볼아웃)

    expect(game.inning).toBe(2)
    expect(game.half).toBe('초')
    expect(game.outs).toBe(0)
    expect(game.bases).toEqual({ first: false, second: false, third: false })
  })

  it('3아웃 이전에는 이닝이 유지된다', () => {
    const game = applyAtBatOutcome(우리공격상태({ outs: 1 }), 땅볼아웃)

    expect(game.outs).toBe(2)
    expect(game.half).toBe('말')
    expect(game.inning).toBe(1)
  })

  it('홈런은 주자를 모두 불러들여 점수에 반영된다', () => {
    const 주자둘 = 우리공격상태({ bases: { first: true, second: true, third: false } })

    const game = applyAtBatOutcome(주자둘, { kind: '홈런' })

    expect(game.ourScore).toBe(3)
  })

  it('9회말 3아웃에 동점이 아니면 경기가 끝난다', () => {
    const 마지막이닝 = 우리공격상태({ inning: INNINGS_PER_GAME, outs: 2, opponentScore: 1 })

    const game = applyAtBatOutcome(마지막이닝, 땅볼아웃)

    expect(game.isFinished).toBe(true)
    expect(game.inning).toBe(INNINGS_PER_GAME)
  })

  it('경기가 끝난 뒤의 타석은 상태를 바꾸지 않는다', () => {
    const 종료됨 = applyAtBatOutcome(
      우리공격상태({ inning: INNINGS_PER_GAME, outs: 2, opponentScore: 1 }),
      땅볼아웃,
    )

    expect(applyAtBatOutcome(종료됨, { kind: '홈런' })).toBe(종료됨)
  })
})

describe('isPlayerTurn', () => {
  it('우리 공격이고 타순이 플레이어 자리면 참이다', () => {
    const game = 우리공격상태({ battingOrderIndex: PLAYER_BATTING_ORDER_INDEX })

    expect(isPlayerTurn(game)).toBe(true)
  })

  it('타순이 다르면 거짓이다', () => {
    expect(isPlayerTurn(우리공격상태({ battingOrderIndex: 0 }))).toBe(false)
  })
})

describe('resultOf', () => {
  it('점수에 따라 승·무·패를 가른다', () => {
    expect(resultOf(우리공격상태({ ourScore: 5, opponentScore: 3 }))).toBe('승')
    expect(resultOf(우리공격상태({ ourScore: 3, opponentScore: 3 }))).toBe('무')
    expect(resultOf(우리공격상태({ ourScore: 1, opponentScore: 3 }))).toBe('패')
  })
})

describe('경기 종료 규칙 — 0xb68fc (누락 탐색 9차)', () => {
  it('9회말 이후 앞서는 순간 끝난다 (끝내기)', () => {
    const game = applyAtBatOutcome(우리공격상태({ inning: 9, outs: 0, opponentScore: 1, bases: { first: true, second: false, third: false } }), { kind: '홈런' })

    expect([game.isFinished, game.ourScore]).toEqual([true, 2])
  })

  it('9회초가 끝났을 때 우리가 앞서면 말 공격 없이 끝난다', () => {
    const game = applyOpponentInning({ ...createGame(), inning: 9, ourScore: 3, opponentScore: 1 }, 1)

    expect(game.isFinished).toBe(true)
  })

  it('9회말 3아웃에 동점이면 연장 10회초로 간다', () => {
    const game = applyAtBatOutcome(우리공격상태({ inning: 9, outs: 2 }), 땅볼아웃)

    expect([game.isFinished, game.inning, game.half]).toEqual([false, 10, '초'])
  })

  it('연장은 12회까지다 — 원본 상한 코드는 없다 (추정)', () => {
    const game = applyAtBatOutcome(우리공격상태({ inning: MAXIMUM_INNINGS, outs: 2 }), 땅볼아웃)

    expect([game.isFinished, resultOf(game)]).toEqual([true, '무'])
  })

  it('7회 이후 초 공격이 끝났을 때 우리가 10점 이상 앞서면 콜드게임', () => {
    expect(applyOpponentInning({ ...createGame(), inning: 7, ourScore: 11, opponentScore: 0 }, 1).isFinished).toBe(true)
    expect(applyOpponentInning({ ...createGame(), inning: 6, ourScore: 11, opponentScore: 0 }, 1).isFinished).toBe(false)
  })

  it('7회 이후 말 공격이 끝났을 때 상대가 10점 이상 앞서면 콜드게임', () => {
    const game = applyAtBatOutcome(우리공격상태({ inning: 7, outs: 2, opponentScore: 10 }), 땅볼아웃)

    expect(game.isFinished).toBe(true)
  })
})
