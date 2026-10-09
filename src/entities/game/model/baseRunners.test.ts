import { describe, expect, it } from 'vitest'
import {
  EMPTY_BASE_RUNNERS,
  effectiveRunnersOf,
  runnersAfterPlay,
  runnersBehindCursor,
  runnersFitBases,
  shiftRunners,
  survivorsWithoutPlayOf,
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

describe('루 상황 세우기 0xa9a10 — 찬 루를 3 → 1 루로 세며 k 번째 루에 커서 − k', () => {
  it('만루면 3루 = 바로 앞 타자 · 2루 = 둘 앞 · 1루 = 셋 앞, 0 칸 아래는 9 로 돈다', () => {
    expect(runnersBehindCursor({ first: true, second: true, third: true }, 1)).toEqual({ first: 7, second: 8, third: 0 })
  })

  it('빈 루는 건너뛰고 k 를 안 올린다 — 1·3루면 3루 = 커서 − 1 · 1루 = 커서 − 2', () => {
    expect(runnersBehindCursor({ first: true, second: false, third: true }, 5)).toEqual({ first: 3, second: null, third: 4 })
    expect(runnersBehindCursor({ first: false, second: true, third: false }, 5)).toEqual({ first: null, second: 4, third: null })
  })
})

describe('진행기를 안 도는 결과의 신원 — 정산 0xa8024 가 보는 목록(삼진 · 볼넷 · 사구 · 홈런)', () => {
  it('볼넷은 타자주자가 0번에 들고 밀린 주자만 간다 — 1·3루면 3루 주자는 그대로, 타자는 1루 · 1루 주자는 2루', () => {
    const game = { ...createGame(2, 0), bases: { first: true, second: false, third: true }, runners: { first: 4, second: null, third: 6 } }
    const after = applyAtBatOutcome(game, { kind: '볼넷' })
    expect(after.runners).toEqual({ first: game.battingOrderIndex % 9, second: 4, third: 6 })
  })

  it('만루 사구는 3루 주자가 홈을 밟고 나머지가 한 루씩, 삼진은 루의 주자가 그대로', () => {
    expect(survivorsWithoutPlayOf({ first: true, second: true, third: true }, '사구')).toEqual([0, 1, 2])
    expect(survivorsWithoutPlayOf({ first: false, second: true, third: true }, '삼진')).toEqual([2, 3])
    expect(survivorsWithoutPlayOf({ first: true, second: true, third: true }, '홈런')).toEqual([])
    expect(survivorsWithoutPlayOf({ first: true, second: false, third: false }, '아웃')).toBeNull()
  })
})
