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
  judgePitcherSeasonAwards,
  myPitcherLeagueRecordOf,
  pitcherAwardRoleOf,
  pitcherSalaryNegotiationRankOf,
  recordPitcherSeasonMvp,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { NO_TEAM } from '@/entities/awards/model/seasonAwards'
import {
  EMPTY_LEAGUE_PITCHER_LINE,
  leaguePitcherIdOf,
} from '@/entities/league/model/leaguePlayerStats'

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

describe('투수편 개인 타이틀·MVP·연봉 등급 (0x8dad4 · 0x8dd60 · 0xa4d78)', () => {
  /** 규정 이닝 45 = 135 아웃 (0x9d7d0 의 0x2d) */
  const 좋은성적 = {
    games: 12,
    outs: 405,
    runsAllowed: 10,
    saves: 0,
    strikeouts: 200,
    pitches: 1500,
    wins: 20,
    losses: 1,
  }

  it('선발 보직은 다승왕·삼진왕·방어왕 세 칸이다 (종류 표 0xd4f24)', () => {
    const 시상 = judgePitcherSeasonAwards(투수({ stats: 좋은성적 }))

    expect(시상.titles.map((칸) => 칸.name)).toEqual(['다승왕', '삼진왕', '방어왕'])
  })

  it('구원 보직이면 첫째가 세이브왕으로 바뀐다 (0xb6ded == 2)', () => {
    const 마무리 = 투수({ role: PITCHER_ROLE.relief, stats: { ...좋은성적, saves: 30 } })

    expect(pitcherAwardRoleOf(마무리)).toBe('마무리')
    expect(judgePitcherSeasonAwards(마무리).titles.map((칸) => 칸.name)).toEqual([
      '세이브왕',
      '삼진왕',
      '방어왕',
    ])
  })

  it('리그 투수 표가 비어 있으면 내 성적만으로 세 타이틀을 쓸어 담고 MVP 가 된다', () => {
    const 시상 = judgePitcherSeasonAwards(투수({ stats: 좋은성적 }))

    expect(시상.wonCount).toBe(3)
    expect(시상.isMostValuablePlayer).toBe(true)
    // 등급 k = 타이틀 3 + MVP 2 = 5 (강경 384 / 정중 388 자리)
    expect(pitcherSalaryNegotiationRankOf(투수({ stats: 좋은성적 }))).toBe(5)
  })

  it('한 번도 안 던졌으면(아웃 0) 순위표에서 빠져 수상이 없다', () => {
    const 시상 = judgePitcherSeasonAwards(투수())

    expect(시상.wonCount).toBe(0)
    expect(시상.isMostValuablePlayer).toBe(false)
    expect(시상.titles.every((칸) => 칸.teamId === NO_TEAM)).toBe(true)
  })

  it('규정 이닝(45)을 못 채우면 방어왕만 빠진다', () => {
    const 시상 = judgePitcherSeasonAwards(투수({ stats: { ...좋은성적, outs: 100 } }))
    const 방어왕 = 시상.titles.find((칸) => 칸.name === '방어왕')

    expect(시상.wonCount).toBe(2)
    expect(방어왕?.isMine).toBe(false)
    expect(방어왕?.teamId).toBe(NO_TEAM)
  })

  it('CPU 투수가 더 많이 이기면 다승왕을 뺏긴다 — 리그 표가 재료다', () => {
    const 나은CPU = {
      ...EMPTY_LEAGUE_PITCHER_LINE,
      outs: 405,
      runsAllowed: 200,
      strikeouts: 10,
      wins: 30,
    }
    const 시상 = judgePitcherSeasonAwards(
      투수({
        stats: 좋은성적,
        leaguePlayerStats: { batters: {}, pitchers: { [leaguePitcherIdOf(1, 0)]: 나은CPU } },
      }),
    )
    const 다승왕 = 시상.titles.find((칸) => 칸.name === '다승왕')

    expect(다승왕?.isMine).toBe(false)
    expect(다승왕?.teamId).toBe(1)
    expect(시상.wonCount).toBe(2)
    // 세 칸을 다 못 먹었고 목표 달성 수를 못 세니 MVP 도 없다 (투수 목표 표 0xd7e9a 미이식)
    expect(시상.isMostValuablePlayer).toBe(false)
  })

  it('MVP 면 그 해 비트가 career+0x1ca 에 남는다 (0xa4d2c)', () => {
    const 남김 = recordPitcherSeasonMvp(투수({ season: 3, stats: 좋은성적 }))

    expect(남김.mvpSeasonBits).toBe(1 << 2)
    // 수상이 없으면 커리어를 그대로 돌려준다
    expect(recordPitcherSeasonMvp(투수({ season: 3 })).mvpSeasonBits).toBe(0)
  })

  it('내 선수 줄은 실점을 자책점 자리에도 그대로 쓴다 (웹엔 실책이 없다 — 근사)', () => {
    const 줄 = myPitcherLeagueRecordOf(투수({ stats: 좋은성적 }))

    expect(줄.atBatsOrOuts).toBe(405)
    expect(줄.hits).toBe(10)
    expect(줄.earnedRuns).toBe(10)
    expect(줄.isMine).toBe(true)
  })
})
