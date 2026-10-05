import { describe, expect, it } from 'vitest'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import {
  canStartSteal,
  isStealAllowedInPlayKind,
  pitchPlayKindOf,
  STEAL_PLAY_KIND,
  stealTargetBaseOf,
} from '@/entities/fielding/model/stealStart'
import { PASSED_BALL_PLAY_KIND } from '@/entities/fielding/model/passedBall'

const 일루 = { ...EMPTY_BASES, first: true }
const 일이루 = { ...EMPTY_BASES, first: true, second: true }
const 일삼루 = { ...EMPTY_BASES, first: true, third: true }
const 만루 = { first: true, second: true, third: true }

describe('도루 출발 0xa9bd4 — 0xae794 · 0xa97a0 · 0xa9924', () => {
  it('도루를 받는 플레이 종류는 0x232 = {1, 4, 5, 9} 뿐이다', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(isStealAllowedInPlayKind)).toEqual([1, 4, 5, 9])
  })

  it('목표 루는 0xb6228 — 3루 주자는 홈(4)으로 뛴다', () => {
    expect([1, 2, 3].map(stealTargetBaseOf)).toEqual([2, 3, 4])
  })

  it('그 루에 주자가 없으면 못 뛴다', () => {
    expect(canStartSteal({ bases: EMPTY_BASES }, 1)).toBe(false)
    expect(canStartSteal({ bases: 일루 }, 2)).toBe(false)
  })

  it('앞 주자가 서 있으면 바로 앞 루가 비어야 한다 — 1·2루의 1루 주자 · 만루는 앞 주자만', () => {
    expect(canStartSteal({ bases: 일이루 }, 1)).toBe(false)
    expect(canStartSteal({ bases: 일이루 }, 2)).toBe(true)
    expect(canStartSteal({ bases: 일삼루 }, 1)).toBe(true)
    expect(canStartSteal({ bases: 만루 }, 1)).toBe(false)
    expect(canStartSteal({ bases: 만루 }, 2)).toBe(false)
    expect(canStartSteal({ bases: 만루 }, 3)).toBe(true)
  })

  it('앞 주자가 이번 투구에 이미 출발했으면 뒤 주자도 뛸 수 있다 (겹도루)', () => {
    expect(canStartSteal({ bases: 일이루, alreadyStealing: [2] }, 1)).toBe(true)
    expect(canStartSteal({ bases: 만루, alreadyStealing: [3] }, 2)).toBe(true)
  })

  it('플레이 종류가 거르개 밖이면 못 뛴다', () => {
    expect(canStartSteal({ bases: 일루, playKind: 2 }, 1)).toBe(false)
  })
})

describe('투구 뒤 수비 판 고르기 0x3e062~0x3e116', () => {
  it('0.1% 사건이 서면 도루 중이어도 종류 9 가 먼저다 — 볼넷·사구만 빠진다', () => {
    expect(pitchPlayKindOf({ passedBall: true, pitchJudgement: 1, stealing: true, outs: 0 })).toBe(PASSED_BALL_PLAY_KIND)
    expect(pitchPlayKindOf({ passedBall: true, pitchJudgement: 3, stealing: false, outs: 0 })).toBeNull()
    expect(pitchPlayKindOf({ passedBall: true, pitchJudgement: 4, stealing: true, outs: 0 })).toBe(STEAL_PLAY_KIND)
  })

  it('도루 중이면 종류 5 — 단 2아웃 삼진은 판을 안 연다', () => {
    expect(pitchPlayKindOf({ passedBall: false, pitchJudgement: 1, stealing: true, outs: 2 })).toBe(STEAL_PLAY_KIND)
    expect(pitchPlayKindOf({ passedBall: false, pitchJudgement: 5, stealing: true, outs: 1 })).toBe(STEAL_PLAY_KIND)
    expect(pitchPlayKindOf({ passedBall: false, pitchJudgement: 5, stealing: true, outs: 2 })).toBeNull()
    expect(pitchPlayKindOf({ passedBall: false, pitchJudgement: 1, stealing: false, outs: 0 })).toBeNull()
  })
})
