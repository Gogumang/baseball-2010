import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  RIVAL_PAIRS,
  applySeasonGameEvaluation,
  evaluateSeasonGame,
  isRivalGame,
  moraleChangeOf,
  popularityChangeOf,
  popularityCompleteGameOf,
  reputationCompleteGameOf,
} from '@/entities/season-mode/model/seasonEvaluation'
import { SEASON_RECORD_CODE, recordSeasonGameEvent } from '@/entities/season-mode/model/seasonReputation'

const 상태 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonState => {
  const base = startNewSeason(0, '테스트구단')
  return { ...base, record: { ...base.record, ...덮어쓰기 } }
}

const 무실점 = { allowedBaserunner: false, allowedHit: false, allowedRun: false }

describe('인기도 0xa6734', () => {
  it('패배는 −2 에서 시작한다', () => {
    expect(popularityChangeOf(false, 1, 1, null)).toBe(-2)
  })

  it('승리 완투는 퍼펙트 8 · 노히트 7 · 완봉 6 · 완투 5, 완투가 아니면 4 다', () => {
    expect(popularityChangeOf(true, 1, 0, '퍼펙트')).toBe(8)
    expect(popularityChangeOf(true, 1, 0, '노히트')).toBe(7)
    expect(popularityChangeOf(true, 1, 0, '완봉')).toBe(6)
    expect(popularityChangeOf(true, 1, 0, '완투')).toBe(5)
    expect(popularityChangeOf(true, 1, 0, null)).toBe(4)
  })

  it('득점 보정은 이겨도 져도 붙는다', () => {
    expect(popularityChangeOf(false, 16, 0, null)).toBe(-2 + 4)
    expect(popularityChangeOf(false, 0, 0, null)).toBe(-2 - 1)
    expect(popularityChangeOf(true, 3, 10, null)).toBe(4 + 1 - 5)
  })

  it('범위는 −8 ~ +12 다', () => {
    expect(popularityChangeOf(false, 0, 10, null)).toBe(-8)
    expect(popularityChangeOf(true, 16, 0, '퍼펙트')).toBe(12)
  })
})

describe('완투 판정 — ⚠️ 인기도와 평판이 서로 다른 칸을 본다', () => {
  it('인기도는 현재 이닝, 평판은 정규 마지막 이닝으로 잰다', () => {
    // 9회까지(이닝 idx 8) 27아웃을 잡은 경우 — 둘 다 완투로 본다
    expect(popularityCompleteGameOf(27, 8, 무실점)).toBe('퍼펙트')
    expect(reputationCompleteGameOf(27, 8, 무실점)).toBe('퍼펙트')
  })

  it('연장 완투는 인기도만 받는다 (평판식은 st+0x69 = 8 을 보므로 어긋난다)', () => {
    // 11회(이닝 idx 10) 33아웃 — 인기도는 완투, 평판은 완투가 아니다
    expect(popularityCompleteGameOf(33, 10, { ...무실점, allowedRun: true })).toBe('완투')
    expect(reputationCompleteGameOf(33, 8, { ...무실점, allowedRun: true })).toBeNull()
  })

  it('인기도의 퍼펙트는 아웃 27 이하일 때만이다', () => {
    expect(popularityCompleteGameOf(33, 10, 무실점)).toBe('노히트')
    // 평판식에는 그 제한이 없다
    expect(reputationCompleteGameOf(33, 10, 무실점)).toBe('퍼펙트')
  })

  it('아웃 수가 안 맞으면 완투가 아니다', () => {
    expect(popularityCompleteGameOf(20, 8, 무실점)).toBeNull()
  })
})

describe('사기 0xa7442 — 승 +5 / 패 −10, 라이벌전은 두 배', () => {
  it('라이벌 표 0xd8a90 은 (0,1)(2,7)(3,6)(4,5)(8,9) 다', () => {
    expect(RIVAL_PAIRS).toEqual([
      [0, 1],
      [2, 7],
      [3, 6],
      [4, 5],
      [8, 9],
    ])
  })

  it('짝은 순서와 무관하다', () => {
    expect(isRivalGame(2, 7)).toBe(true)
    expect(isRivalGame(7, 2)).toBe(true)
    expect(isRivalGame(0, 2)).toBe(false)
  })

  it('라이벌전이면 승 +10 · 패 −20', () => {
    expect(moraleChangeOf(true, false)).toBe(5)
    expect(moraleChangeOf(false, false)).toBe(-10)
    expect(moraleChangeOf(true, true)).toBe(10)
    expect(moraleChangeOf(false, true)).toBe(-20)
  })
})

describe('경기 뒤 평가 묶음', () => {
  it('세 값을 한 번에 낸다 — 평판은 16칸으로 계산한다', () => {
    let gameRecord = startNewSeason(0, 'T').record.gameRecord
    for (let i = 0; i < 3; i += 1) {
      gameRecord = recordSeasonGameEvent(gameRecord, SEASON_RECORD_CODE.탈삼진, '수비')
    }
    const state = 상태({ gameRecord })
    const 결과 = evaluateSeasonGame(state.record, {
      myRuns: 4,
      opponentRuns: 1,
      won: true,
      popularityCompleteGame: '완봉',
      reputationCompleteGame: '완봉',
      opponentTeamId: 1,
    })
    expect(결과.popularityChange).toBe(6 + 1)
    // s = +1(탈삼진 3개) + 2(승리) + 4(완봉) = 7 → 등급 +4
    expect(결과.reputationChange).toBe(4)
    // 팀 0 과 팀 1 은 라이벌이다
    expect(결과.moraleChange).toBe(10)
  })

  it('적용하면 인기도·평판·사기가 상한 안에서 움직이고 직전 값이 남는다', () => {
    const state = 상태({ popularity: 9_995, reputation: 998 })
    const 뒤 = applySeasonGameEvaluation(state, {
      popularityChange: 12,
      reputationChange: 6,
      moraleChange: -20,
    })
    expect(뒤.record.popularity).toBe(9_999)
    expect(뒤.record.reputation).toBe(999)
    expect(뒤.teamMorale).toBe(80)
    expect(뒤.record.lastPopularityChange).toBe(12)
    expect(뒤.record.lastReputationGrade).toBe(6)
    expect(뒤.record.lastMoraleChange).toBe(-20)
  })

  it('사기는 0 아래로 내려가지 않는다', () => {
    const 뒤 = applySeasonGameEvaluation(
      { ...상태(), teamMorale: 5 },
      { popularityChange: 0, reputationChange: 0, moraleChange: -20 },
    )
    expect(뒤.teamMorale).toBe(0)
  })
})
