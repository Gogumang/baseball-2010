import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  ENDING_BONUS_GAME_POINTS,
  KOREA_TEAM_ID,
  LEAGUE_FIRST_GAME_POINTS,
  LEAGUE_FIRST_THRESHOLDS,
  NATIONAL_CUP_RUNNER_UP_TEXT_MONEY,
  applySeasonReward,
  judgeSeasonEnding,
  koreanSeriesRewardOf,
  nationalCupRewardOf,
  nextLeagueFirstAward,
} from '@/entities/season-mode/model/seasonRewards'

const 기본 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스트구단').record,
  ...덮어쓰기,
})

describe('한국시리즈 보상 0x85ec', () => {
  it('우승 StrMODE[197] 은 인기도 +25 · 평판 +30 · 소지금 +40(4000만)', () => {
    expect(koreanSeriesRewardOf(0)).toEqual({
      popularity: 25,
      reputation: 30,
      money: 40,
      gamePoint: 0,
      messageId: 197,
    })
  })

  it('준우승 StrMODE[198] 은 15·15·15', () => {
    expect(koreanSeriesRewardOf(1).messageId).toBe(198)
    expect(koreanSeriesRewardOf(1).money).toBe(15)
  })

  it('3위 아래는 보상이 없다', () => {
    expect(koreanSeriesRewardOf(2).messageId).toBe(0)
    expect(koreanSeriesRewardOf(2).money).toBe(0)
  })
})

describe('국가대항전 보상 0x896c', () => {
  it('대한민국(팀 10) 우승이면 30·40·50 과 1000 G', () => {
    const 보상 = nationalCupRewardOf(KOREA_TEAM_ID, true)
    expect(보상).toEqual({ popularity: 30, reputation: 40, money: 50, gamePoint: 1000, messageId: 199 })
  })

  it('⚠️ 준우승 — 문구는 2500만인데 실제로는 2000만만 더한다 (원본 버그 그대로)', () => {
    const 보상 = nationalCupRewardOf(11, true)
    expect(보상.messageId).toBe(200)
    expect(보상.money).toBe(20)
    expect(NATIONAL_CUP_RUNNER_UP_TEXT_MONEY).toBe(25)
    expect(보상.money).not.toBe(NATIONAL_CUP_RUNNER_UP_TEXT_MONEY)
  })

  it('결승에도 못 가면 보상이 없다', () => {
    expect(nationalCupRewardOf(11, false).messageId).toBe(0)
  })
})

describe('보상 적용 — 상한에서 막힌다', () => {
  it('인기도 9999 · 평판 999 · 소지금 9999', () => {
    const 뒤 = applySeasonReward(기본({ popularity: 9_990, reputation: 995, money: 9_990 }), koreanSeriesRewardOf(0))
    expect(뒤.popularity).toBe(9_999)
    expect(뒤.reputation).toBe(999)
    expect(뒤.money).toBe(9_999)
  })
})

describe('리그 1위 G StrMODE[223]', () => {
  it('문턱 3·10·20 에 1000·5000·10000 G 다', () => {
    expect(LEAGUE_FIRST_THRESHOLDS).toEqual([3, 10, 20])
    expect(LEAGUE_FIRST_GAME_POINTS).toEqual([1, 5, 10])
  })

  it('한 번에 하나만 준다', () => {
    const record = 기본({ regularSeasonFirsts: 12 })
    const 첫번째 = nextLeagueFirstAward(record, 0)
    expect(첫번째).toEqual({ threshold: 3, gamePoint: 1_000, bit: 0 })
    const 두번째 = nextLeagueFirstAward(record, 0b001)
    expect(두번째).toEqual({ threshold: 10, gamePoint: 5_000, bit: 1 })
    expect(nextLeagueFirstAward(record, 0b011)).toBeNull()
  })

  it('문턱에 못 미치면 안 준다', () => {
    expect(nextLeagueFirstAward(기본({ regularSeasonFirsts: 2 }), 0)).toBeNull()
  })

  it('이미 받은 비트는 다시 주지 않는다 — 시즌을 새로 해도 전역 저장이라 그대로다', () => {
    expect(nextLeagueFirstAward(기본({ regularSeasonFirsts: 20 }), 0b111)).toBeNull()
  })
})

describe('10년차 엔딩 0xa3084', () => {
  it('10년차(연차 idx 9)가 아니면 엔딩이 아니다', () => {
    expect(judgeSeasonEnding(기본({ yearIndex: 8, popularity: 3_000, regularSeasonFirsts: 10 }))).toBeNull()
  })

  it('앞에서부터 먼저 맞는 것이 답이다', () => {
    const 열년차 = (popularity: number, firsts: number) =>
      judgeSeasonEnding(기본({ yearIndex: 9, popularity, regularSeasonFirsts: firsts }))
    expect(열년차(2_001, 10)).toBe(4)
    expect(열년차(1_501, 7)).toBe(3)
    expect(열년차(1_001, 4)).toBe(2)
    expect(열년차(801, 0)).toBe(1)
    expect(열년차(800, 10)).toBe(0)
  })

  it('우승이 없어도 인기도 801 이상이면 "지역 인기 구단" 이다', () => {
    expect(judgeSeasonEnding(기본({ yearIndex: 9, popularity: 900, regularSeasonFirsts: 0 }))).toBe(1)
  })

  it('엔딩 보너스 G 는 0·3000·6000·9000·12000 이다', () => {
    expect(ENDING_BONUS_GAME_POINTS).toEqual([0, 3, 6, 9, 12])
  })
})
