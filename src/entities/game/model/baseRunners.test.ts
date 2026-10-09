import { describe, expect, it } from 'vitest'
import {
  EMPTY_BASE_RUNNERS,
  effectiveRunnersOf,
  runnersAfterPlay,
  runnersFitBases,
  shiftRunners,
} from '@/entities/game/model/baseRunners'
import { applyAtBatOutcome, createGame, runnersOfGame } from '@/entities/game/model/gameState'

describe('주자 신원 — 원본 주자 목록(sim+0x80 · 0xa93ac 0번에 끼움 · 0xc0fb4 전원 +n)', () => {
  it('타자는 0번 칸(루 0)에 들고 전원이 n 루 간다 — 4 이상이면 앞선 주자부터 득점', () => {
    const shifted = shiftRunners({ first: 3, second: null, third: 1 }, 2, 4)
    expect(shifted.runners).toEqual({ first: null, second: 4, third: 3 })
    expect(shifted.scored).toEqual([1])
  })

  it('볼넷 c1918 도 전원 +1 — 2루 주자도 3루로 간다', () => {
    expect(shiftRunners({ first: null, second: 7, third: null }, 1, 8).runners).toEqual({ first: 8, second: null, third: 7 })
  })

  it('루 상황과 안 맞는 신원은 예전 근사(타순을 거꾸로 센다)로 본다', () => {
    const bases = { first: true, second: false, third: true }
    expect(runnersFitBases({ first: 2, second: null, third: null }, bases)).toBe(false)
    expect(effectiveRunnersOf(bases, { first: 2, second: null, third: null }, (back) => 10 - back)).toEqual({
      first: 9,
      second: null,
      third: 7,
    })
    expect(effectiveRunnersOf(bases, { first: 2, second: null, third: 5 }, (back) => 10 - back)).toEqual({
      first: 2,
      second: null,
      third: 5,
    })
  })

  it('수비 진행기 판은 살아남은 주자(투구 때 루)대로 앉힌다 — 포스 아웃된 1루 주자 대신 타자가 1루', () => {
    const next = runnersAfterPlay(
      { first: 5, second: 4, third: null },
      { first: true, second: false, third: true },
      { batter: 6, batterReached: false, runsScored: 0, survivorsFromBase: [0, 2] },
    )
    expect(next).toEqual({ first: 6, second: null, third: 4 })
  })

  it('타석 결과로 신원을 민다 — 안타면 타자가 들고, 아웃이면 주자가 그대로 남는다', () => {
    // 선공(측 0) — 1회초가 우리 공격, 1번(칸 0)부터
    let game = createGame(2, 0)
    // 1번(칸 0) 안타 → 1루
    game = applyAtBatOutcome(game, { kind: '안타', bases: 1 })
    expect(game.runners).toEqual({ first: 0, second: null, third: null })
    // 2번(칸 1) 2루타 → 2루 · 1루 주자 3루
    game = applyAtBatOutcome(game, { kind: '안타', bases: 2 })
    expect(runnersOfGame(game)).toEqual({ first: null, second: 1, third: 0 })
    // 3번 삼진 — 그대로
    game = applyAtBatOutcome(game, { kind: '삼진' })
    expect(runnersOfGame(game)).toEqual({ first: null, second: 1, third: 0 })
    expect(EMPTY_BASE_RUNNERS).toEqual({ first: null, second: null, third: null })
  })
})
