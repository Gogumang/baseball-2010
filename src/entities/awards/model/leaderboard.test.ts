import { describe, expect, it } from 'vitest'
import {
  BATTING_AVERAGE_SCALE,
  EMPTY_LEAGUE_RECORD,
  LEADER_KIND,
  LEADERBOARD_SIZE,
  QUALIFIED_AT_BATS,
  QUALIFIED_INNINGS,
  battingAverageOf,
  earnedRunAverageOf,
  leaderOf,
  leaderValueOf,
  rankLeaders,
} from '@/entities/awards/model/leaderboard'
import type { LeagueRecord } from '@/entities/awards/model/leaderboard'

const 기록 = (overrides: Partial<LeagueRecord> = {}): LeagueRecord => ({
  ...EMPTY_LEAGUE_RECORD,
  ...overrides,
})

describe('순위표 제외 규칙 — binary.mod 0x9d789', () => {
  it('타수·아웃(+0x20)이 0 이면 어느 종류에도 끼지 못한다', () => {
    const 미출전 = 기록({ atBatsOrOuts: 0, homeRuns: 40 })

    expect(leaderValueOf(미출전, LEADER_KIND.홈런)).toBeNull()
  })

  it('+0xa 비트6 선수는 빠진다 (0xb633c)', () => {
    const 제외 = 기록({ isOutOfRanking: true, atBatsOrOuts: 300, homeRuns: 40 })

    expect(leaderValueOf(제외, LEADER_KIND.홈런)).toBeNull()
  })

  it('홈런·타점·탈삼진·승·패·세이브에는 규정이 없다 — 한 타석만 서도 끼운다', () => {
    const 대타 = 기록({ atBatsOrOuts: 1, homeRuns: 1, runsBattedIn: 1 })

    expect(leaderValueOf(대타, LEADER_KIND.홈런)).toBe(1)
    expect(leaderValueOf(대타, LEADER_KIND.타점)).toBe(1)
  })
})

describe('규정 타수·이닝 — 다섯째 인자 1 이면 104 / 45 고정 (0x9d7d0)', () => {
  it('타율은 104 타수부터 센다', () => {
    const 미달 = 기록({ atBatsOrOuts: QUALIFIED_AT_BATS - 1, hits: 60 })
    const 충족 = 기록({ atBatsOrOuts: QUALIFIED_AT_BATS, hits: 60 })

    expect(leaderValueOf(미달, LEADER_KIND.타율)).toBeNull()
    expect(leaderValueOf(충족, LEADER_KIND.타율)).toBe(576)
  })

  it('방어율은 아웃/3 이 45 이닝 이상이어야 한다 (버림)', () => {
    const 미달 = 기록({ atBatsOrOuts: QUALIFIED_INNINGS * 3 - 1, earnedRuns: 10 })
    const 충족 = 기록({ atBatsOrOuts: QUALIFIED_INNINGS * 3, earnedRuns: 10 })

    expect(leaderValueOf(미달, LEADER_KIND.방어율)).toBeNull()
    expect(leaderValueOf(충족, LEADER_KIND.방어율)).not.toBeNull()
  })
})

describe('타율 0xb8e3d = min(1000, trunc(안타 × 1000 / 타수))', () => {
  it('버림이다 — 3할3푼3리는 333', () => {
    expect(battingAverageOf(기록({ atBatsOrOuts: 3, hits: 1 }))).toBe(333)
  })

  it('10할을 넘길 수 없다 (min 1000)', () => {
    expect(battingAverageOf(기록({ atBatsOrOuts: 10, hits: 20 }))).toBe(BATTING_AVERAGE_SCALE)
  })

  it('타수가 0 이면 타율이 없다', () => {
    expect(battingAverageOf(기록())).toBeNull()
  })
})

describe('방어율 (0xb6ce9 — 식은 추정, 순서만 쓴다)', () => {
  it('자책점이 적을수록 작다', () => {
    const 에이스 = 기록({ atBatsOrOuts: 450, earnedRuns: 30 })
    const 패전조 = 기록({ atBatsOrOuts: 450, earnedRuns: 90 })

    expect(earnedRunAverageOf(에이스)!).toBeLessThan(earnedRunAverageOf(패전조)!)
  })

  it('150이닝 50자책 = 방어율 3.00 (×100)', () => {
    expect(earnedRunAverageOf(기록({ atBatsOrOuts: 450, earnedRuns: 50 }))).toBe(300)
  })
})

describe('순위 매기기', () => {
  const 홈런타자 = (teamId: number, name: string, homeRuns: number) =>
    기록({ teamId, name, atBatsOrOuts: 300, homeRuns })

  it('큰 값이 1위다', () => {
    const 표 = [홈런타자(0, '가', 10), 홈런타자(1, '나', 30), 홈런타자(2, '다', 20)]

    expect(rankLeaders(표, LEADER_KIND.홈런).map((entry) => entry.record.name)).toEqual([
      '나',
      '다',
      '가',
    ])
  })

  it('방어율만 작은 쪽이 1위다', () => {
    const 표 = [
      기록({ name: '가', atBatsOrOuts: 450, earnedRuns: 90 }),
      기록({ name: '나', atBatsOrOuts: 450, earnedRuns: 30 }),
    ]

    expect(leaderOf(표, LEADER_KIND.방어율)?.record.name).toBe('나')
  })

  it('동점이면 먼저 들어간 쪽이 1위다 — 원본은 "기존 칸 ≥ 새 값이면 안 끼운다"', () => {
    const 표 = [홈런타자(3, '먼저', 30), 홈런타자(0, '나중', 30)]

    expect(leaderOf(표, LEADER_KIND.홈런)?.record.name).toBe('먼저')
  })

  it('상위 10명만 들고 있는다', () => {
    const 표 = Array.from({ length: 30 }, (_unused, index) => 홈런타자(index % 10, `타자${index}`, index))

    expect(rankLeaders(표, LEADER_KIND.홈런)).toHaveLength(LEADERBOARD_SIZE)
    expect(leaderOf(표, LEADER_KIND.홈런)?.value).toBe(29)
  })

  it('자격자가 하나도 없으면 1위도 없다 — 웹의 지금 상태(CPU 기록 없음)가 그렇다', () => {
    expect(leaderOf([], LEADER_KIND.홈런)).toBeNull()
    expect(leaderOf([기록({ atBatsOrOuts: 0, homeRuns: 99 })], LEADER_KIND.홈런)).toBeNull()
  })
})
