import { describe, expect, it } from 'vitest'
import { TEAMS } from '@/shared/config/original/teams'
import {
  FIRST_STAGE,
  KOREA_TEAM_ID,
  NATIONAL_CUP_TEAM_IDS,
  UNDECIDED_TEAM,
  coinFlipChampion,
  createNationalCup,
  endNationalCupDay,
  isKoreaInFinal,
  isNationalCupOver,
  matchTeamOf,
  nationalCupMatchupOf,
  nationalCupRankingOf,
  otherMatchOf,
  recordNationalCupResult,
} from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** `rand(0, 2)` 가 늘 같은 값을 내도록 고정한다 */
const 고정난수 = (value: number): RandomPort => ({
  next: () => 0,
  nextInRange: () => value,
  pick: (candidates) => candidates[0],
})

const 승패를넣은대회 = (cup: NationalCup, wins: readonly number[], losses: readonly number[]): NationalCup => ({
  ...cup,
  wins: [...wins],
  losses: [...losses],
})

describe('국가대항전 초기화 (0xb7bf0)', () => {
  it('참가 4국은 대한민국·일본·쿠바·미국 (원본 팀 10~13) 이다', () => {
    const cup = createNationalCup()
    expect(cup.teams).toEqual([10, 11, 12, 13])
    expect(cup.teams.map((id) => TEAMS[id].name)).toEqual(['대한민국', '일본', '쿠바', '미국'])
    expect(NATIONAL_CUP_TEAM_IDS[0]).toBe(KOREA_TEAM_ID)
  })

  it('승·패는 0, 단계는 4, 결승 두 팀과 우승국은 미정(15) 이다', () => {
    const cup = createNationalCup()
    expect(cup.wins).toEqual([0, 0, 0, 0])
    expect(cup.losses).toEqual([0, 0, 0, 0])
    expect(cup.stage).toBe(FIRST_STAGE)
    expect(cup.finalists).toEqual([UNDECIDED_TEAM, UNDECIDED_TEAM])
    expect(cup.champion).toBe(UNDECIDED_TEAM)
    expect(cup.day).toBe(0)
  })

  it('대진 표 0xd89bc 대로 1R 한-일/쿠-미 · 2R 한-쿠/일-미 · 3R 한-미/일-쿠 다', () => {
    expect(createNationalCup().matches).toEqual([
      [10, 11, 12, 13],
      [10, 12, 11, 13],
      [10, 13, 11, 12],
    ])
  })
})

describe('대진 읽기 0xb7614(L, n, k)', () => {
  it('n > 1 이면 라운드 (4 − n) 의 k 번째 칸이다', () => {
    const cup = createNationalCup()
    expect([0, 1, 2, 3].map((slot) => matchTeamOf(cup, 4, slot))).toEqual([10, 11, 12, 13])
    expect([0, 1, 2, 3].map((slot) => matchTeamOf(cup, 3, slot))).toEqual([10, 12, 11, 13])
    expect([0, 1, 2, 3].map((slot) => matchTeamOf(cup, 2, slot))).toEqual([10, 13, 11, 12])
  })

  it('n == 1 이면 결승 두 팀, n <= 0 이면 우승국이다', () => {
    const cup: NationalCup = { ...createNationalCup(), finalists: [10, 13], champion: 13 }
    expect(matchTeamOf(cup, 1, 0)).toBe(10)
    expect(matchTeamOf(cup, 1, 1)).toBe(13)
    expect(matchTeamOf(cup, 0, 0)).toBe(13)
  })
})

describe('4국 순위 0xb7f0c', () => {
  it('승 내림차순이 먼저다', () => {
    const cup = 승패를넣은대회(createNationalCup(), [1, 3, 2, 0], [2, 0, 1, 3])
    expect(nationalCupRankingOf(cup)).toEqual([11, 12, 10, 13])
  })

  it('승이 같으면 패가 적은 쪽이 앞선다', () => {
    const cup = 승패를넣은대회(createNationalCup(), [1, 1, 1, 1], [2, 0, 3, 1])
    expect(nationalCupRankingOf(cup)).toEqual([11, 13, 10, 12])
  })

  it('승·패가 모두 같으면 원래 차례(한·일·쿠·미)가 앞선다', () => {
    expect(nationalCupRankingOf(createNationalCup())).toEqual([10, 11, 12, 13])
  })
})

describe('승패 기록 0xb76dc / 0xb77e0', () => {
  it('참가국 순번 칸의 승·패를 올린다', () => {
    const cup = recordNationalCupResult(createNationalCup(), 12, 10)
    expect(cup.wins).toEqual([0, 0, 1, 0])
    expect(cup.losses).toEqual([1, 0, 0, 0])
  })

  it('결승 날(단계 1)에 이긴 팀이 우승국 L+0xc4 가 된다', () => {
    const 결승: NationalCup = { ...createNationalCup(), stage: 1, finalists: [10, 11] }
    expect(recordNationalCupResult(결승, 11, 10).champion).toBe(11)
  })

  it('풀리그 날에는 우승국을 건드리지 않는다', () => {
    expect(recordNationalCupResult(createNationalCup(), 11, 10).champion).toBe(UNDECIDED_TEAM)
  })
})

describe('하루 끝 0xb818c 의 국가대항전 가지', () => {
  it('날짜는 늘고 단계는 4 → 3 → 2 → 1 → 0 으로 줄어든다', () => {
    let cup = createNationalCup()
    const 단계 = [cup.stage]
    for (let i = 0; i < 4; i += 1) {
      cup = endNationalCupDay(cup)
      단계.push(cup.stage)
    }
    expect(단계).toEqual([4, 3, 2, 1, 0])
    expect(cup.day).toBe(4)
  })

  it('단계가 1 이 될 때 결승 두 팀 = 풀리그 1·2위 다', () => {
    const 풀리그끝 = 승패를넣은대회({ ...createNationalCup(), stage: 2 }, [3, 2, 1, 0], [0, 1, 2, 3])
    expect(endNationalCupDay(풀리그끝).finalists).toEqual([10, 11])
  })

  it('다음 상대는 줄어든 단계에서 읽는다 — 1R 일본 → 2R 쿠바 → 3R 미국', () => {
    let cup = createNationalCup()
    const 상대 = [nationalCupMatchupOf(cup)?.opponent]
    for (let i = 0; i < 2; i += 1) {
      cup = endNationalCupDay(cup)
      상대.push(nationalCupMatchupOf(cup)?.opponent)
    }
    expect(상대).toEqual([11, 12, 13])
  })
})

describe('오늘 치를 경기 0x1c46c', () => {
  it('대한민국은 늘 내 팀이다 — 결승에서 칸 0 이 다른 나라면 둘을 맞바꾼다', () => {
    const 결승: NationalCup = { ...createNationalCup(), stage: 1, finalists: [11, 10] }
    expect(nationalCupMatchupOf(결승)).toEqual({ myTeam: 10, opponent: 11 })
  })

  it('대회가 끝났으면 치를 경기가 없다', () => {
    expect(nationalCupMatchupOf({ ...createNationalCup(), stage: 0 })).toBeNull()
  })

  it('같은 라운드 둘째 경기는 칸 2·3 이고, 결승 날에는 없다', () => {
    expect(otherMatchOf(createNationalCup())).toEqual([12, 13])
    expect(otherMatchOf({ ...createNationalCup(), stage: 1 })).toBeNull()
  })
})

describe('대한민국이 결승에 못 갔을 때 0xb858c', () => {
  it('⚠️ 원본 그대로 — 결승을 치르지 않고 rand(0,2) 로 우승국을 정한다', () => {
    const 결승: NationalCup = { ...createNationalCup(), stage: 1, finalists: [11, 13] }
    expect(isKoreaInFinal(결승)).toBe(false)
    // rand(0,2) == 0 이면 L+0xaf(2위), 아니면 L+0xae(1위)
    expect(coinFlipChampion(결승, 고정난수(0)).champion).toBe(13)
    expect(coinFlipChampion(결승, 고정난수(1)).champion).toBe(11)
  })

  it('대한민국이 결승 두 팀에 있으면 0xb8565 가 참이다', () => {
    expect(isKoreaInFinal({ ...createNationalCup(), finalists: [10, 13] })).toBe(true)
  })
})

describe('대회 끝 판정', () => {
  it('단계가 0 이면 끝이다', () => {
    expect(isNationalCupOver({ ...createNationalCup(), stage: 0 })).toBe(true)
    expect(isNationalCupOver(createNationalCup())).toBe(false)
  })
})
