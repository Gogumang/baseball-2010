import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  PITCHER_CONTINUE_COST_GAME_POINT,
  applyPitcherEndingBonus,
  canContinueAfterPitcherEnding,
  continueAfterPitcherEnding,
  isContinuablePitcherEnding,
  judgePitcherEnding,
  pitcherEndingBonusOf,
  pitcherInjuryEndingOf,
  pitcherRetirementEndingOf,
  pitcherYearEndStepOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  ...overrides,
})

/** 소지금은 만원 단위라 100 만원 한 칸 = 100 이다 */
const 억 = (백만원: number) => 백만원 * 100

describe('투수편 엔딩 판정 0xa3a84 — 타자편과 같은 식이다 (B-6)', () => {
  it('6년차까지는 판정이 없다', () => {
    expect(judgePitcherEnding(투수({ season: 6, popularity: 9999 }))).toBeNull()
  })

  it('7년차 인기도 499 이하면 방출(1)이다', () => {
    expect(judgePitcherEnding(투수({ season: 7, popularity: 499 }))).toBe(1)
    expect(judgePitcherEnding(투수({ season: 7, popularity: 500 }))).toBe(2)
  })

  it('13년차는 인기도·평판·소지금으로 6~9 가 갈린다', () => {
    expect(judgePitcherEnding(투수({ season: 13, popularity: 3600, skillIds: [7] }))).toBe(9)
    // 스킬 7 이 없으면 전설이 아니다 — 평판이 낮으면 6~8 도 못 타고 5 로 떨어진다
    expect(judgePitcherEnding(투수({ season: 13, popularity: 3600, reputation: 0, skillIds: [] }))).toBe(5)
    expect(judgePitcherEnding(투수({ season: 13, popularity: 3100, reputation: 700, money: 억(400) }))).toBe(8)
    expect(judgePitcherEnding(투수({ season: 13, popularity: 2600, reputation: 500 }))).toBe(7)
    expect(judgePitcherEnding(투수({ season: 13, popularity: 2100, reputation: 300 }))).toBe(6)
  })

  it('부상 출전 20경기면 연차와 무관하게 부상 엔딩(0)이다 — 판정의 첫 줄이다 (B-7)', () => {
    expect(judgePitcherEnding(투수({ season: 1, injuredGamesPlayed: 20 }))).toBe(0)
    expect(judgePitcherEnding(투수({ season: 1, injuredGamesPlayed: 19 }))).toBeNull()
    expect(pitcherInjuryEndingOf(투수({ season: 1, injuredGamesPlayed: 20 }))).toBe(0)
    // 방출은 부상 엔딩이 아니다 — 관리 화면 진입은 0 만 본다
    expect(pitcherInjuryEndingOf(투수({ season: 7, popularity: 100 }))).toBeNull()
  })

  it('⚠️ 원본 그대로 — 7년차 이상이라도 인기도가 정확히 1000 이면 판정이 없다', () => {
    expect(judgePitcherEnding(투수({ season: 8, popularity: 1000, money: 0 }))).toBeNull()
  })
})

describe('연말 분기 상태 132 (0x10c54)', () => {
  it('1~6년차는 새 시즌으로 이어진다 (연봉협상 380 자리)', () => {
    expect(pitcherYearEndStepOf(투수({ season: 1 }))).toEqual({ kind: '새시즌' })
    expect(pitcherYearEndStepOf(투수({ season: 6, popularity: 0 }))).toEqual({ kind: '새시즌' })
  })

  it('7년차 인기도 499 이하는 방출 엔딩(501)이다', () => {
    expect(pitcherYearEndStepOf(투수({ season: 7, popularity: 400 }))).toEqual({ kind: '엔딩', endingIndex: 1 })
  })

  it('7~12년차는 은퇴 선택(502)이 뜬다 — 8~12년차는 인기도가 낮아도 방출되지 않는다', () => {
    expect(pitcherYearEndStepOf(투수({ season: 7, popularity: 2000 }))).toEqual({ kind: '은퇴선택' })
    expect(pitcherYearEndStepOf(투수({ season: 12, popularity: 0 }))).toEqual({ kind: '은퇴선택' })
  })

  it('13년차는 반드시 엔딩이다 (은퇴식 504)', () => {
    expect(pitcherYearEndStepOf(투수({ season: 13, popularity: 1600 }))).toEqual({ kind: '엔딩', endingIndex: 5 })
    // 판정이 없는 인기도 1000 이면 은퇴식 기본값 2 로 떨어진다
    expect(pitcherYearEndStepOf(투수({ season: 13, popularity: 1000 }))).toEqual({ kind: '엔딩', endingIndex: 2 })
  })

  it('은퇴를 고르면(496 → 503) 판정값이 곧 엔딩 번호다', () => {
    expect(pitcherRetirementEndingOf(투수({ season: 9, popularity: 1600 }))).toBe(5)
    expect(pitcherRetirementEndingOf(투수({ season: 9, popularity: 1000 }))).toBe(2)
  })
})

describe('엔딩 보너스와 이어하기 (141 틀 0x1bbc4)', () => {
  it('보너스 표 0xcc40c — 부상·방출은 0 이고 전설은 20000 이다', () => {
    expect(pitcherEndingBonusOf(0)).toBe(0)
    expect(pitcherEndingBonusOf(1)).toBe(0)
    expect(pitcherEndingBonusOf(2)).toBe(4000)
    expect(pitcherEndingBonusOf(9)).toBe(20_000)
    expect(applyPitcherEndingBonus(투수({ gamePoint: 100 }), 2).gamePoint).toBe(4100)
  })

  it('부상·방출만 이어하기를 묻고 5000 G포인트가 있어야 한다', () => {
    expect(isContinuablePitcherEnding(1)).toBe(true)
    expect(isContinuablePitcherEnding(2)).toBe(false)
    expect(canContinueAfterPitcherEnding(투수({ gamePoint: 4999 }), 0)).toBe(false)
    expect(canContinueAfterPitcherEnding(투수({ gamePoint: 5000 }), 0)).toBe(true)
    expect(canContinueAfterPitcherEnding(투수({ gamePoint: 99_999 }), 2)).toBe(false)
  })

  it('부상 엔딩을 이어하면 같은 시즌에 남고 부상 누적만 풀린다', () => {
    const 이어함 = continueAfterPitcherEnding(
      투수({ season: 4, gamesPlayed: 12, gamePoint: 6000, endingIndex: 0, isInjured: true, injuredGamesPlayed: 20 }),
    )

    expect(이어함.season).toBe(4)
    expect(이어함.gamesPlayed).toBe(12)
    expect(이어함.isInjured).toBe(false)
    expect(이어함.injuredGamesPlayed).toBe(0)
    expect(이어함.endingIndex).toBeNull()
    expect(이어함.gamePoint).toBe(6000 - PITCHER_CONTINUE_COST_GAME_POINT)
  })

  it('방출 엔딩을 이어하면 새 시즌으로 넘어간다 (0x1b768) — 스태미나도 되돌아온다', () => {
    const 이어함 = continueAfterPitcherEnding(
      투수({ season: 7, gamesPlayed: 45, gamePoint: 5000, endingIndex: 1, stamina: 1200 }),
    )

    expect(이어함.season).toBe(8)
    expect(이어함.gamesPlayed).toBe(0)
    expect(이어함.stamina).toBe(10_000)
    expect(이어함.gamePoint).toBe(0)
  })
})
