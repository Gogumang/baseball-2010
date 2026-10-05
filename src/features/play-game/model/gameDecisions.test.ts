import { describe, expect, it } from 'vitest'
import { createGame } from '@/entities/game/model/gameState'
import type { GameState } from '@/entities/game/model/gameState'
import { EMPTY_DECISION_STATE, NO_SIDE } from '@/features/play-pitcher-game/model/winLossSave'
import {
  decisionsAfterPitcherChange,
  decisionsAfterPlay,
  decisionsAfterRuns,
  pitcherOfRecordNamesOf,
} from '@/features/play-game/model/gameDecisions'

/** 사람이 후공(측 1) — 초에 상대(측 0)가 공격한다 */
const 경기 = (overrides: Partial<GameState>): GameState => ({ ...createGame(2, 1), ...overrides })
const 마운드 = { our: 3, opponent: 5 }

describe('승·패·세 칸 — 득점 0xa5c34 를 한 점씩', () => {
  it('5회까지 득점은 승리 투수를 안 건드리고 패전 투수만 잡는다 (0xa5d02)', () => {
    const before = 경기({ inning: 5, half: '말' })
    const after = { ...before, ourScore: 2 }
    const decisions = decisionsAfterPlay(EMPTY_DECISION_STATE, before, after, 마운드)

    expect(decisions.winner.side).toBe(NO_SIDE)
    // 지는 쪽 = 상대(측 0), 그 순간 상대 마운드 투수
    expect(decisions.loser).toEqual({ side: 0, number: 5 })
  })

  it('6회 이후 득점이면 앞선 팀의 지금 마운드 투수가 승리 투수다', () => {
    const before = 경기({ inning: 6, half: '말', opponentScore: 1 })
    const decisions = decisionsAfterRuns(EMPTY_DECISION_STATE, before, 2, 마운드)

    // 첫 점은 동점(1:1)이라 아무도 아니고, 둘째 점에서 우리(측 1)가 앞선다
    expect(decisions.winner).toEqual({ side: 1, number: 3 })
    expect(decisions.loser).toEqual({ side: 0, number: 5 })
  })

  it('세이브 후보는 투수가 올라올 때만 잡힌다 (0xa60c0)', () => {
    // 9회초 상대 공격, 우리가 4:1 로 앞섬 — 3점 차·남은 아웃 3 → 코드 3 (동점 주자 조건 3 ≤ 0+2 는 거짓)
    const game = 경기({ inning: 9, half: '초', ourScore: 4, opponentScore: 1 })
    const decisions = decisionsAfterPitcherChange(EMPTY_DECISION_STATE, game, { our: 7, opponent: 5 })

    expect(decisions.save).toEqual({ side: 1, number: 7 })
    expect(decisions.saveCode).toBe(3)
  })

  it('점수 차 ≤ 주자 + 2 면 코드 1 이 덮어쓴다 — 그 순간 주자 수를 본다', () => {
    const game = 경기({ inning: 9, half: '초', ourScore: 4, opponentScore: 1 })
    const decisions = decisionsAfterPitcherChange(EMPTY_DECISION_STATE, game, { our: 7, opponent: 5 }, 0, 1)

    expect(decisions.saveCode).toBe(1)
  })

  it('이름은 측으로 팀을 가려 찾고 측 2 면 null 이다', () => {
    const decisions = { ...EMPTY_DECISION_STATE, winner: { side: 1, number: 3 }, loser: { side: 0, number: 5 } }
    const names = pitcherOfRecordNamesOf(decisions, 1, (ours, number) => `${ours ? '우리' : '상대'}${number}`)

    expect(names).toEqual({ win: '우리3', loss: '상대5', save: null })
  })
})
