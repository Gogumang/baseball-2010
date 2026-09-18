import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import {
  atBatPopularityPoints,
  atBatPenaltyCounts,
  evaluateGame,
  managerCommentIndexOf,
  popularityChangeOf,
  updateStreaks,
} from '@/entities/career/model/gameEvaluation'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })
const 기록 = (stats: Partial<typeof EMPTY_SEASON_STATS> = {}) => ({ ...EMPTY_SEASON_STATS, ...stats })

describe('타석 인기도 점수 — 0xa59c0', () => {
  it('타점이 있으면 단타 3 · 2루타 4 · 3루타 5 · 홈런 6 — 더 더하지 않는다 (점검 7차)', () => {
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 1 }, runsBattedIn: 1, outsInPlay: 0, isWalkOff: false })).toBe(3)
    expect(atBatPopularityPoints({ outcome: { kind: '홈런' }, runsBattedIn: 4, outsInPlay: 0, isWalkOff: false })).toBe(6)
  })

  it('타점이 없으면 단타 1 · 장타 2, 끝내기는 4·5', () => {
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 2 }, runsBattedIn: 0, outsInPlay: 0, isWalkOff: false })).toBe(2)
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 1 }, runsBattedIn: 1, outsInPlay: 0, isWalkOff: true })).toBe(5)
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 1 }, runsBattedIn: 0, outsInPlay: 0, isWalkOff: true })).toBe(4)
  })

  it('한 플레이 2아웃 이상(병살)이면 −1, 보통 아웃은 0', () => {
    expect(atBatPopularityPoints({ outcome: { kind: '아웃', detail: '땅볼아웃' }, runsBattedIn: 0, outsInPlay: 2, isWalkOff: false })).toBe(-1)
    expect(atBatPopularityPoints({ outcome: { kind: '삼진' }, runsBattedIn: 0, outsInPlay: 1, isWalkOff: false })).toBe(0)
  })
})

describe('타석 감점 카운터 — 0xa59c0 (+0x118 병살 · +0x11c 득점권 아웃)', () => {
  const 타석 = (overrides = {}) => ({ outsInPlay: 1, runsBattedIn: 0, isWalkOff: false, hadSecondBaseRunner: true, ...overrides })

  it('2루 주자를 두고 아웃되면 득점권 아웃, 2아웃 이상이면 병살도 센다', () => {
    expect(atBatPenaltyCounts(타석())).toEqual({ doublePlays: 0, scoringPositionOuts: 1 })
    expect(atBatPenaltyCounts(타석({ outsInPlay: 2 }))).toEqual({ doublePlays: 1, scoringPositionOuts: 1 })
  })

  it('타점이 났거나 끝내기면 세지 않는다 (희생플라이 등)', () => {
    expect(atBatPenaltyCounts(타석({ runsBattedIn: 1 }))).toEqual({ doublePlays: 0, scoringPositionOuts: 0 })
    expect(atBatPenaltyCounts(타석({ isWalkOff: true, outsInPlay: 2 }))).toEqual({ doublePlays: 0, scoringPositionOuts: 0 })
  })

  it('3루 주자만 있으면 득점권 아웃이 아니다 — 원본은 2루(a97a1 인덱스 2)만 본다', () => {
    expect(atBatPenaltyCounts(타석({ hadSecondBaseRunner: false }))).toEqual({ doublePlays: 0, scoringPositionOuts: 0 })
  })
})

describe('인기도 변화 구간 — 0xa690c', () => {
  it('점수 → −2~6', () => {
    expect([11, 8, 6, 4, 3, 1, 0, -1, -3].map((points) => popularityChangeOf(points, 기록()))).toEqual([6, 5, 4, 3, 2, 1, 0, -1, -2])
  })

  it('사이클링 히트면 +7 점', () => {
    expect(popularityChangeOf(0, 기록({ hits: 4, doubles: 1, triples: 1, homeRuns: 1 }))).toBe(4)
  })
})

describe('감독 평가 글 — 0x1278c', () => {
  it('평판 구간 기준(39/48/57/66) + 인기도 변화 칸', () => {
    expect(managerCommentIndexOf(선수({ reputation: 100, battingOrder: 9 }), -2)).toBe(39)
    expect(managerCommentIndexOf(선수({ reputation: 500, battingOrder: 9 }), 6)).toBe(57 + 8)
  })

  it('타자는 타순과 무관하게 같은 칸을 쓴다 — 2배 규칙은 투수편만 (0x1283c)', () => {
    expect(managerCommentIndexOf(선수({ reputation: 800, battingOrder: 3 }), 3)).toBe(66 + 5)
  })
})

describe('evaluateGame — 경기 뒤 인기도·평판·사기 (0xa719c)', () => {
  const 경기 = (overrides = {}) => ({
    result: '승' as const,
    stats: 기록({ hits: 1 }),
    popularityPoints: 0,
    doublePlays: 0,
    scoringPositionOuts: 0,
    ourTeamId: 0,
    opponentTeamId: 2,
    ...overrides,
  })

  it('승리는 사기 +5, 그 밖(무승부 포함)은 −7, 행운 스킬(6)이 있으면 +1', () => {
    expect(evaluateGame(선수(), 경기()).moraleChange).toBe(5)
    expect(evaluateGame(선수(), 경기({ result: '무' })).moraleChange).toBe(-7)
    expect(evaluateGame(선수({ skillIds: [6] }), 경기({ result: '패' })).moraleChange).toBe(-6)
  })

  it('라이벌전 ×2 를 먼저 하고 인기도 보정은 나중에 더한다 (0xa73ce → 0xa7408, 점검 9차)', () => {
    expect(evaluateGame(선수(), 경기({ result: '패', opponentTeamId: 3, ourTeamId: 6, popularityPoints: 4 })).moraleChange).toBe(-14 + 1)
  })

  it('라이벌전(0,1)(2,7)(3,6)(4,5)(8,9)은 사기 변화 2배 (b8f68)', () => {
    expect(evaluateGame(선수(), 경기({ opponentTeamId: 1 })).moraleChange).toBe(10)
    expect(evaluateGame(선수(), 경기({ result: '패', ourTeamId: 7, opponentTeamId: 2 })).moraleChange).toBe(-14)
  })

  it('졌어도 인기도 변화가 2 이상이면 그 절반만큼 덜 잃는다', () => {
    expect(evaluateGame(선수(), 경기({ result: '패', popularityPoints: 8 })).moraleChange).toBe(-7 + 2)
  })

  it('무안타면 평판 −5, 병살 2개 이상 −2, 득점권 아웃이 있으면 −1', () => {
    expect(evaluateGame(선수(), 경기({ stats: 기록(), doublePlays: 2, scoringPositionOuts: 1 })).reputationChange).toBe(-5 - 2 - 1)
  })

  it('평판은 인기도 변화·안타·홈런 합계로 오른다', () => {
    const evaluation = evaluateGame(선수(), 경기({ stats: 기록({ hits: 2, homeRuns: 1 }), popularityPoints: 8 }))

    expect(evaluation.popularityChange).toBe(5)
    expect(evaluation.reputationChange).toBe(3 + 2 + 2)
  })
})

describe('연속 기록 — 0x8a6fc', () => {
  it('2안타 경기가 3연속이면 평판 +10 과 코멘트 108', () => {
    const result = updateStreaks(선수({ streaks: { multiHit: 2, homeRun: 0, hitless: 0 } }), 기록({ hits: 2 }))

    expect(result.career.streaks.multiHit).toBe(3)
    expect(result.notices).toEqual([{ labelIndex: 100, count: 3, commentIndex: 108, reputationChange: 10 }])
  })

  it('무안타 4연속이면 평판 −10 · 코멘트 111, 3년차 이상이면 하락세(17) 스킬을 얻는다', () => {
    const result = updateStreaks(선수({ season: 3, streaks: { multiHit: 0, homeRun: 0, hitless: 3 } }), 기록())

    expect(result.notices).toEqual([{ labelIndex: 102, count: 4, commentIndex: 111, reputationChange: -10 }])
    expect(result.career.skillIds).toContain(17)
  })

  it('2안타 10연속이면 하락세를 잃는다', () => {
    const result = updateStreaks(선수({ skillIds: [17], streaks: { multiHit: 9, homeRun: 0, hitless: 0 } }), 기록({ hits: 3 }))

    expect(result.career.skillIds).not.toContain(17)
  })
})
