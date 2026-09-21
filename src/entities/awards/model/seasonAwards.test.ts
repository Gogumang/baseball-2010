import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import {
  SALARY_FIRM_EVENT_ID,
  SALARY_POLITE_EVENT_ID,
  salaryResultEventId,
} from '@/entities/career/model/seasonFlow'
import { EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'
import type { LeagueRecord } from '@/entities/awards/model/leaderboard'
import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league'
import { leagueBatterIdOf } from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { BATTERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import {
  MAXIMUM_SALARY_RANK,
  careerLeagueRecordsOf,
  leagueRecordsOf,
  MVP_EVENT_ID,
  MVP_MISSED_EVENT_ID,
  NO_TEAM,
  achievedGoalCountForMvp,
  careerMvpCount,
  hasBackToBackMvp,
  hasMvpInSeason,
  judgeSeasonAwards,
  judgeTitles,
  mvpResultEventId,
  myLeagueRecordOf,
  recordMvpSeason,
  salaryNegotiationRankOf,
  salaryRankOf,
  titleResultEventId,
  titleRewardMoneyUnitsOf,
} from '@/entities/awards/model/seasonAwards'

const 선수 = (
  overrides: Partial<PlayerCareer> = {},
  stats: Partial<typeof EMPTY_SEASON_STATS> = {},
): PlayerCareer => ({
  ...createCareer('마선수'),
  ...overrides,
  stats: { ...EMPTY_SEASON_STATS, ...stats },
})

/** 1년차 목표 [260, 44, 3, 22, 50] → 단계 2 는 [286, 48, 3, 24, 55] */
const 내기록 = { atBats: 200, hits: 50, homeRuns: 40, runsBattedIn: 80 }

const 상대 = (overrides: Partial<LeagueRecord>): LeagueRecord => ({
  ...EMPTY_LEAGUE_RECORD,
  teamId: 1,
  name: '상대선수',
  atBatsOrOuts: 200,
  ...overrides,
})

/** 내 선수를 앞에 두고 CPU 를 뒤에 붙인 리그 기록표 */
const 리그표 = (career: PlayerCareer, ...others: readonly LeagueRecord[]): LeagueRecord[] => [
  myLeagueRecordOf(career),
  ...others,
]

describe('개인 타이틀 — binary.mod 0x8dad4 (B-2)', () => {
  it('타자는 홈런왕·타점왕·타율왕 세 칸이다 (표 0xd4f18 = [9, 11, 12])', () => {
    expect(judgeTitles([], '타자').map((title) => title.name)).toEqual(['홈런왕', '타점왕', '타율왕'])
  })

  it('투수는 다승왕·삼진왕·방어왕, 마무리는 첫째가 세이브왕이다 (표 0xd4f24)', () => {
    expect(judgeTitles([], '투수').map((title) => title.name)).toEqual(['다승왕', '삼진왕', '방어왕'])
    expect(judgeTitles([], '마무리').map((title) => title.name)).toEqual([
      '세이브왕',
      '삼진왕',
      '방어왕',
    ])
  })

  it('발표 문구는 StrUSER_EVT[76·77·78] · [79·80·81] · 세이브 82 다', () => {
    expect(judgeTitles([], '타자').map((title) => title.userEventIndex)).toEqual([76, 77, 78])
    expect(judgeTitles([], '투수').map((title) => title.userEventIndex)).toEqual([79, 80, 81])
    expect(judgeTitles([], '마무리')[0].userEventIndex).toBe(82)
  })

  it('수상자가 없으면 팀 칸이 10("없음")이다 — 원본 초기값', () => {
    expect(judgeTitles([], '타자').every((title) => title.teamId === NO_TEAM)).toBe(true)
  })

  it('1위가 내 선수인 칸만 수상이다', () => {
    const career = 선수({}, 내기록)
    const 표 = 리그표(career, 상대({ hits: 100, homeRuns: 30, runsBattedIn: 100 }))
    const titles = judgeTitles(표, '타자')

    // 홈런 40 > 30 · 타점 80 < 100 · 타율 .250 < .500
    expect(titles.map((title) => title.isMine)).toEqual([true, false, false])
    expect(titles[1].winnerName).toBe('상대선수')
  })
})

describe('시즌 MVP — 0x8dd60 (B-3)', () => {
  it('타이틀이 하나도 없으면 목표를 다 채워도 MVP 가 아니다 (0x8de58 의 이른 탈락)', () => {
    const career = 선수({ popularity: 1000, popularityAtSeasonStart: 900 }, 내기록)

    expect(achievedGoalCountForMvp(career)).toBeGreaterThanOrEqual(4)
    expect(judgeSeasonAwards(career, []).isMostValuablePlayer).toBe(false)
  })

  it('타이틀 3개를 독식하면 목표와 상관없이 MVP 다', () => {
    const career = 선수({}, 내기록)
    const 표 = 리그표(career, 상대({ hits: 20, homeRuns: 5, runsBattedIn: 10 }))

    expect(achievedGoalCountForMvp(career)).toBeLessThan(4)
    expect(judgeSeasonAwards(career, 표).isMostValuablePlayer).toBe(true)
  })

  it('타이틀 1개 + 올해의 목표(단계 2) 4개 이상이면 MVP 다', () => {
    const career = 선수({ popularity: 60, popularityAtSeasonStart: 0 }, 내기록)
    const 표 = 리그표(career, 상대({ hits: 100, homeRuns: 30, runsBattedIn: 100 }))

    expect(achievedGoalCountForMvp(career)).toBe(4)
    const awards = judgeSeasonAwards(career, 표)
    expect(awards.wonCount).toBe(1)
    expect(awards.isMostValuablePlayer).toBe(true)
  })

  it('타이틀 1개 + 목표 3개면 MVP 가 아니고, 내가 못 딴 첫 타이틀의 수상자를 보여 준다 (0x8df18)', () => {
    const career = 선수({}, 내기록)
    const 표 = 리그표(career, 상대({ name: '김타점', hits: 100, homeRuns: 30, runsBattedIn: 100 }))
    const awards = judgeSeasonAwards(career, 표)

    expect(achievedGoalCountForMvp(career)).toBe(3)
    expect(awards.isMostValuablePlayer).toBe(false)
    expect(awards.mostValuablePlayer).toEqual({ teamId: 1, name: '김타점' })
  })

  it('MVP 면 나를 보여 준다', () => {
    const career = 선수({ teamId: 4 }, 내기록)
    const 표 = 리그표(career, 상대({ hits: 20, homeRuns: 5, runsBattedIn: 10 }))

    expect(judgeSeasonAwards(career, 표).mostValuablePlayer).toEqual({ teamId: 4, name: '마선수' })
  })
})

describe('올해의 목표 단계 2 — 0xa3de8(career, 2)', () => {
  it('다섯 목표를 모두 +trunc(g × 10 / 100) 올려 잡는다', () => {
    // 1년차 목표 [260, 44, 3, 22, 50] → [286, 48, 3, 24, 55] (홈런 3 은 trunc(0.3) = 0 이라 그대로)
    const 딱맞춘선수 = 선수({ popularity: 50, popularityAtSeasonStart: 0 }, { atBats: 200, hits: 44, homeRuns: 3, runsBattedIn: 22 })

    // 연말 기준이면 타율(.220)만 빼고 넷을 채우는데, MVP 기준으로는 홈런 하나만 남는다
    expect(achievedGoalCountForMvp(딱맞춘선수)).toBe(1)
  })

  it('타율도 버림으로 잰다 (0xb8e3d) — .286 이 기준이다', () => {
    // 안타·홈런·타점·인기도는 모두 미달이라 타율 한 칸만 움직인다
    expect(achievedGoalCountForMvp(선수({}, { atBats: 100, hits: 28 }))).toBe(0)
    expect(achievedGoalCountForMvp(선수({}, { atBats: 100, hits: 29 }))).toBe(1)
  })
})

describe('이벤트 번호와 보상 — 0x8b04c · 0x8b370', () => {
  it('타이틀 결과는 371 + 수상 개수다 (371 없음 / 372 1개 / 373 2개 / 374 3개)', () => {
    expect([0, 1, 2, 3].map(titleResultEventId)).toEqual([371, 372, 373, 374])
  })

  it('소지금 보상은 0 · 3 · 6 · 10 (100만원 칸)', () => {
    expect([0, 1, 2, 3].map(titleRewardMoneyUnitsOf)).toEqual([0, 3, 6, 10])
  })

  it('MVP 면 377, 아니면 376 이다', () => {
    expect(mvpResultEventId(true)).toBe(MVP_EVENT_ID)
    expect(mvpResultEventId(false)).toBe(MVP_MISSED_EVENT_ID)
  })
})

describe('연도별 MVP 비트 career+0x1ca — 0xa4d2c · 0xa4d40 · 0xa4d50', () => {
  it('연차idx 자리에 비트를 세운다', () => {
    expect(recordMvpSeason(0, 1)).toBe(0b1)
    expect(recordMvpSeason(0, 13)).toBe(1 << 12)
  })

  it('그 해 MVP 였는지 되읽는다', () => {
    const bits = recordMvpSeason(recordMvpSeason(0, 2), 5)

    expect(hasMvpInSeason(bits, 2)).toBe(true)
    expect(hasMvpInSeason(bits, 5)).toBe(true)
    expect(hasMvpInSeason(bits, 1)).toBe(false)
  })

  it('통산 MVP 횟수는 bit0..12 를 센다', () => {
    const bits = [1, 3, 7, 13].reduce(recordMvpSeason, 0)

    expect(careerMvpCount(bits)).toBe(4)
  })

  it('13년차를 넘는 연차는 비트를 세우지 않는다', () => {
    expect(recordMvpSeason(0, 14)).toBe(0)
    expect(hasMvpInSeason(0xffff, 14)).toBe(false)
  })

  it('2년 연속 MVP 를 가려낸다 — 칭호 32 "괴물 타자" · 48 "괴물 투수"', () => {
    expect(hasBackToBackMvp([2, 3].reduce(recordMvpSeason, 0))).toBe(true)
    expect(hasBackToBackMvp([2, 4].reduce(recordMvpSeason, 0))).toBe(false)
  })
})

describe('연봉협상 등급 k — 0xa4d78 (B-5)', () => {
  /** k 를 정확히 만들어 내는 상황 표 */
  const 상황: Readonly<Record<number, () => { career: PlayerCareer; records: LeagueRecord[] }>> = {
    // 타이틀 0 · MVP 없음 — CPU 기록이 없는 지금 웹의 상태와 같다
    0: () => ({ career: 선수({}, 내기록), records: [] }),
    // 홈런왕만 (타점·타율은 상대) · 목표 3개 → MVP 아님
    1: () => {
      const career = 선수({}, 내기록)
      return { career, records: 리그표(career, 상대({ hits: 100, homeRuns: 30, runsBattedIn: 100 })) }
    },
    // 홈런왕·타점왕 (타율은 상대) · 목표 3개 → MVP 아님
    2: () => {
      const career = 선수({}, 내기록)
      return { career, records: 리그표(career, 상대({ hits: 100, homeRuns: 30, runsBattedIn: 70 })) }
    },
    // 홈런왕 + 목표 4개 → MVP (+2)
    3: () => {
      const career = 선수({ popularity: 60, popularityAtSeasonStart: 0 }, 내기록)
      return { career, records: 리그표(career, 상대({ hits: 100, homeRuns: 30, runsBattedIn: 100 })) }
    },
    // 홈런왕·타점왕 + 목표 4개 → MVP (+2)
    4: () => {
      const career = 선수({ popularity: 60, popularityAtSeasonStart: 0 }, 내기록)
      return { career, records: 리그표(career, 상대({ hits: 100, homeRuns: 30, runsBattedIn: 70 })) }
    },
    // 3관왕 → 타이틀 3개 독식이라 MVP (+2) = 5, 최대값
    5: () => {
      const career = 선수({}, 내기록)
      return { career, records: 리그표(career, 상대({ hits: 20, homeRuns: 5, runsBattedIn: 10 })) }
    },
  }

  it.each([0, 1, 2, 3, 4, 5])('상황 표가 실제로 k = %i 를 낸다', (expected) => {
    const { career, records } = 상황[expected]()

    expect(salaryNegotiationRankOf(career, records)).toBe(expected)
  })

  it('k 는 타이틀 수 + (올해 MVP 면 2) 다', () => {
    const { career, records } = 상황[5]()
    const awards = judgeSeasonAwards(career, records)

    expect(awards.wonCount).toBe(3)
    expect(awards.isMostValuablePlayer).toBe(true)
    expect(salaryRankOf(awards)).toBe(MAXIMUM_SALARY_RANK)
  })

  /**
   * B-5 의 등급표를 그대로 못 박는다. **확률이 아니라 결정적**이다 (0x8d058).
   *   k==0 → 강경 387(−20% 평판−30) / 정중 391(−10% 평판−20)
   *   k≤2  → 386(+10% 평판−20)      / 390(+5% 평판−10)
   *   k≤4  → 385(+20% 평판−10)      / 389(+10%)
   *   k==5 → 384(+30%)              / 388(+20%)
   */
  const 등급표: readonly (readonly [number, number, number])[] = [
    // [k, 강경(381) 결과, 정중(382) 결과]
    [0, 387, 391],
    [1, 386, 390],
    [2, 386, 390],
    [3, 385, 389],
    [4, 385, 389],
    [5, 384, 388],
  ]

  it.each(등급표)('k = %i → 강경 %i · 정중 %i', (k, firm, polite) => {
    const { career, records } = 상황[k]()
    const rank = salaryNegotiationRankOf(career, records)

    expect(rank).toBe(k)
    expect(salaryResultEventId(SALARY_FIRM_EVENT_ID, rank)).toBe(firm)
    expect(salaryResultEventId(SALARY_POLITE_EVENT_ID, rank)).toBe(polite)
  })

  /**
   * 기록표를 생략하면 **커리어가 들고 있는 리그 선수 기록표**를 쓴다.
   * (예전에는 넘길 표 자체가 없어 늘 0 이었다 — 그 가정을 여기서 걷어낸다.)
   */
  it('기록표를 생략하면 커리어의 리그 선수 표로 계산한다 — 아무도 안 뛰었으면 혼자 3관왕이다', () => {
    const career = 선수({ popularity: 4000, popularityAtSeasonStart: 0 }, { atBats: 300, hits: 150, homeRuns: 60, runsBattedIn: 150 })

    // CPU 표가 비어 있으면 타수가 있는 선수가 나 하나라 세 부문 모두 1위 → 3관왕 + MVP = 5
    expect(salaryNegotiationRankOf(career)).toBe(MAXIMUM_SALARY_RANK)
    expect(salaryResultEventId(SALARY_FIRM_EVENT_ID, salaryNegotiationRankOf(career))).toBe(384)
  })

  it('CPU 선수가 나보다 잘하면 등급이 내려간다 — 표가 실제로 판정에 쓰인다', () => {
    const 나 = { atBats: 300, hits: 150, homeRuns: 60, runsBattedIn: 150 }
    const career = 선수({ popularity: 4000, popularityAtSeasonStart: 0 }, 나)
    // 다른 팀(3번) 로스터 0번 타자에게 홈런·타점만 더 얹는다 → 홈런왕·타점왕을 뺏기고 타율왕만 남는다
    const 강타자 = leagueBatterIdOf(3, 0)
    const 표: LeaguePlayerStats = {
      batters: { [강타자]: { atBats: 300, hits: 100, homeRuns: 70, runsBattedIn: 200 } },
    }

    // 타이틀 1개(타율왕) + 올해의 목표를 채워 MVP +2 = 3 — 3관왕이던 k = 5 에서 내려온다
    expect(salaryNegotiationRankOf({ ...career, leaguePlayerStats: 표 })).toBe(3)
  })
})

describe('leagueRecordsOf — 기록표를 순위표 순회 순서로 편다 (0x9d789)', () => {
  it('열 팀 × 12명이 팀 번호 순서로 나오고, 내 선수는 자기 팀 명단 끝에 끼어든다', () => {
    const career = 선수({ teamId: 2 }, { atBats: 100 })
    const records = careerLeagueRecordsOf(career)

    expect(records).toHaveLength(LEAGUE_TEAM_COUNT * BATTERS_PER_TEAM + 1)
    expect(records[2 * BATTERS_PER_TEAM + BATTERS_PER_TEAM].isMine).toBe(true)
    expect(records.map((record) => record.teamId)).toEqual([...records].sort((a, b) => a.teamId - b.teamId).map((record) => record.teamId))
  })

  it('표에 있는 선수만 성적이 붙고 나머지는 타수 0 이라 순위표에서 빠진다', () => {
    const id = leagueBatterIdOf(5, 7)
    const records = leagueRecordsOf({ batters: { [id]: { atBats: 120, hits: 48, homeRuns: 12, runsBattedIn: 40 } } })

    expect(records[id]).toMatchObject({ teamId: 5, atBatsOrOuts: 120, hits: 48, homeRuns: 12, runsBattedIn: 40 })
    expect(records.filter((record) => record.atBatsOrOuts > 0)).toHaveLength(1)
  })
})

describe('내 선수의 순위표 한 줄', () => {
  it('타자 칸만 채운다 — career.stats.strikeouts 는 당한 삼진이라 +0x26 과 뜻이 다르다', () => {
    const career = 선수({ teamId: 3 }, { atBats: 200, hits: 60, homeRuns: 20, runsBattedIn: 70, strikeouts: 50 })
    const record = myLeagueRecordOf(career)

    expect(record).toMatchObject({
      teamId: 3,
      name: '마선수',
      isMine: true,
      atBatsOrOuts: 200,
      hits: 60,
      homeRuns: 20,
      runsBattedIn: 70,
      strikeouts: 0,
    })
  })
})

describe('시즌모드 투수 타이틀 (B 4절 2번)', () => {
  it('나리는 세 칸인데 시즌모드는 **네 칸**이다 — 넷째가 세이브왕', () => {
    const 나리 = judgeTitles([], '투수').map((slot) => slot.name)
    const 시즌 = judgeTitles([], '시즌투수').map((slot) => slot.name)

    expect(나리).toEqual(['다승왕', '삼진왕', '방어왕'])
    expect(시즌).toEqual(['다승왕', '삼진왕', '방어왕', '세이브왕'])
  })

  it('나리 마무리는 칸 수는 그대로 셋이고 첫째만 세이브왕이 된다', () => {
    expect(judgeTitles([], '마무리').map((slot) => slot.name)).toEqual(['세이브왕', '삼진왕', '방어왕'])
  })
})
