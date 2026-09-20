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
  it('홈런은 루타가 아니라 득점 수로 센다 — 솔로 3 · 투런 4 · 스리런 5 · 만루 6', () => {
    expect(atBatPopularityPoints({ outcome: { kind: '홈런' }, runsBattedIn: 1, outsInPlay: 0, isWalkOff: false })).toBe(3)
    expect(atBatPopularityPoints({ outcome: { kind: '홈런' }, runsBattedIn: 2, outsInPlay: 0, isWalkOff: false })).toBe(4)
    expect(atBatPopularityPoints({ outcome: { kind: '홈런' }, runsBattedIn: 4, outsInPlay: 0, isWalkOff: false })).toBe(6)
  })

  it('끝내기 홈런은 5, 홈런이 아닌 끝내기(득점 있음)는 4', () => {
    expect(atBatPopularityPoints({ outcome: { kind: '홈런' }, runsBattedIn: 4, outsInPlay: 0, isWalkOff: true })).toBe(5)
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 1 }, runsBattedIn: 1, outsInPlay: 0, isWalkOff: true })).toBe(4)
  })

  it('안타는 득점 점수 + 루타 점수를 더한다 — 2타점 2루타 = 2 + 2 = 4', () => {
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 2 }, runsBattedIn: 2, outsInPlay: 0, isWalkOff: false })).toBe(4)
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 1 }, runsBattedIn: 1, outsInPlay: 0, isWalkOff: false })).toBe(2)
    // 타점이 없으면 루타 점수만 — 3루타는 3 이다 (앞서 2 로 한 칸 모자랐다)
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 3 }, runsBattedIn: 0, outsInPlay: 0, isWalkOff: false })).toBe(3)
    expect(atBatPopularityPoints({ outcome: { kind: '안타', bases: 2 }, runsBattedIn: 0, outsInPlay: 0, isWalkOff: false })).toBe(2)
  })

  it('안타가 아닌 타점도 점수가 된다 — 밀어내기·희생플라이·땅볼 타점 (1점 +1 · 2~3점 +2)', () => {
    expect(atBatPopularityPoints({ outcome: { kind: '아웃', detail: '뜬공아웃' }, runsBattedIn: 1, outsInPlay: 1, isWalkOff: false })).toBe(1)
    expect(atBatPopularityPoints({ outcome: { kind: '볼넷' }, runsBattedIn: 1, outsInPlay: 0, isWalkOff: false })).toBe(1)
    expect(atBatPopularityPoints({ outcome: { kind: '아웃', detail: '땅볼아웃' }, runsBattedIn: 2, outsInPlay: 1, isWalkOff: false })).toBe(2)
  })

  it('한 플레이 2아웃 이상(병살)이면 −1, 보통 아웃은 0', () => {
    expect(atBatPopularityPoints({ outcome: { kind: '아웃', detail: '땅볼아웃' }, runsBattedIn: 0, outsInPlay: 2, isWalkOff: false })).toBe(-1)
    expect(atBatPopularityPoints({ outcome: { kind: '삼진' }, runsBattedIn: 0, outsInPlay: 1, isWalkOff: false })).toBe(0)
  })
})

describe('타석 감점 카운터 — 0xa59c0 (+0x118 병살 · +0x11c 득점권 아웃)', () => {
  const 타석 = (overrides = {}) => ({
    outcome: { kind: '아웃', detail: '땅볼아웃' } as const,
    outsInPlay: 1,
    runsBattedIn: 0,
    isWalkOff: false,
    hadSecondBaseRunner: true,
    ...overrides,
  })

  it('2루 주자를 두고 아웃되면 득점권 아웃, 2아웃 이상이면 병살도 센다', () => {
    expect(atBatPenaltyCounts(타석())).toEqual({ doublePlays: 0, scoringPositionOuts: 1 })
    expect(atBatPenaltyCounts(타석({ outsInPlay: 2 }))).toEqual({ doublePlays: 1, scoringPositionOuts: 1 })
  })

  it('타점이 나도 센다 — 홈런이나 "끝내기 + 득점" 일 때만 빠진다', () => {
    expect(atBatPenaltyCounts(타석({ runsBattedIn: 1 }))).toEqual({ doublePlays: 0, scoringPositionOuts: 1 })
    expect(atBatPenaltyCounts(타석({ outcome: { kind: '홈런' } }))).toEqual({ doublePlays: 0, scoringPositionOuts: 0 })
    expect(atBatPenaltyCounts(타석({ isWalkOff: true, runsBattedIn: 1, outsInPlay: 2 }))).toEqual({ doublePlays: 0, scoringPositionOuts: 0 })
  })

  it('안타여도 득점권 아웃은 센다 — 다만 병살은 안타가 아닐 때만', () => {
    const 안타 = { outcome: { kind: '안타', bases: 1 } as const, outsInPlay: 2 }
    expect(atBatPenaltyCounts(타석(안타))).toEqual({ doublePlays: 0, scoringPositionOuts: 1 })
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

  it('무안타 −5 · 병살 2개 초과 −2 · 득점권 아웃 −1 에 구간 보정이 붙는다', () => {
    // 신인 평판 300 → 구간 i=2 → 감산 −50% 라 −8 이 −4 로 줄어든다
    expect(evaluateGame(선수(), 경기({ stats: 기록(), doublePlays: 2, scoringPositionOuts: 1 })).reputationChange).toBe(-4)
  })

  it('가산에도 구간 보정이 붙는다 — 평판이 낮을수록 크게 오른다', () => {
    const evaluation = evaluateGame(선수(), 경기({ stats: 기록({ hits: 2, homeRuns: 1 }), popularityPoints: 8 }))

    expect(evaluation.popularityChange).toBe(5)
    // 인기도 +3 · 안타 +2 · 홈런 +2 = 7 → 구간 i=2 가산 +50% → 10
    expect(evaluation.reputationChange).toBe(10)
  })

  it('평판이 높을수록 덜 오르고 더 깎인다 (0xd82a0 / 0xd82c8)', () => {
    const 고평판 = 선수({ reputation: 900 })  // i = 8 → 가산 −15% · 감산 +20%
    const 올림 = evaluateGame(고평판, 경기({ stats: 기록({ hits: 2, homeRuns: 1 }), popularityPoints: 8 }))
    expect(올림.reputationChange).toBe(7 - 1)

    const 내림 = evaluateGame(고평판, 경기({ stats: 기록(), doublePlays: 2, scoringPositionOuts: 1 }))
    expect(내림.reputationChange).toBe(-8 - 1)
  })

  it('만루홈런 +2 · 끝내기 +3 · 볼넷 2개 +1 · 동점/역전 득점 +2 칸이 붙는다 (P7 B1)', () => {
    const 기본 = evaluateGame(선수(), 경기({ stats: 기록({ hits: 1 }) })).reputationChange
    const 더함 = evaluateGame(
      선수(),
      경기({
        stats: 기록({ hits: 1 }),
        reputationCounts: { grandSlams: 1, walkOffs: 1, buntHits: 0, walks: 2, goAheadRuns: 1, tyingRuns: 0 },
      }),
    ).reputationChange

    expect(더함).toBeGreaterThan(기본)
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
