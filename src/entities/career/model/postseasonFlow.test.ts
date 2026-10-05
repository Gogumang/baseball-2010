import { describe, expect, it } from 'vitest'
import {
  applyKoreanSeriesReward,
  applyRegularSeasonReward,
  popupAfterChampion,
  pressPostseasonBracket,
  regularSeasonPopupOnEnter,
  REGULAR_SEASON_HIDDEN_ID,
} from '@/entities/career/model/postseasonFlow'
import { createCareer, startNextSeason } from '@/entities/career/model/playerCareer'
import { EMPTY_LEAGUE, LEAGUE_TEAM_COUNT, startPostseason } from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 팀 번호가 작을수록 많이 이긴 리그 — 순위가 0, 1, 2, … 가 된다 */
const 순서대로리그: League = {
  ...EMPTY_LEAGUE,
  wins: Array.from({ length: LEAGUE_TEAM_COUNT }, (_, team) => 40 - team),
  losses: Array.from({ length: LEAGUE_TEAM_COUNT }, (_, team) => 5 + team),
}

const 대진 = (): PostseasonSeries => startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

describe('128 진입 0x120a4 — 정규시즌 우승 팝업 0xb', () => {
  it('정규시즌 1위이고 아직 보상을 안 받았으면 뜬다', () => {
    const career = { ...createCareer('일위'), teamId: 0, league: 순서대로리그, postseason: 대진() }
    expect(regularSeasonPopupOnEnter(career)).toEqual({ kind: '정규시즌우승' })
  })

  it('보상을 받았거나(S+0x77) 1위가 아니면 안 뜬다', () => {
    const base = { ...createCareer('일위'), league: 순서대로리그, postseason: 대진() }
    expect(regularSeasonPopupOnEnter({ ...base, teamId: 0, regularSeasonRewardTaken: true })).toBeNull()
    expect(regularSeasonPopupOnEnter({ ...base, teamId: 1 })).toBeNull()
  })
})

describe('128 키 0x13da0', () => {
  it('내 팀이 지금 시리즈에 있으면 CPU 경기 없이 경기로 간다', () => {
    const random = createSeededRandom(1)
    // 준PO 는 3위(2) 대 4위(3)
    expect(pressPostseasonBracket(대진(), 2, random)).toEqual({ kind: '내경기' })
  })

  it('내 팀이 없으면 CPU 끼리 내 차례까지 돌리고 128 에 머문다 — 한 번 누름에 경기로 가지 않는다', () => {
    const random = createSeededRandom(2010)
    // 2위(1)는 준PO 에 없다 → 준PO 를 끝내고 PO 에 1 이 서면 멈춘다
    const result = pressPostseasonBracket(대진(), 1, random)
    expect(result.kind).toBe('CPU진행')
    if (result.kind !== 'CPU진행') return
    expect(result.series.round).toBe('플레이오프')
    expect(result.series.teams[0]).toBe(1)
    // 다음 누름이 경기다
    expect(pressPostseasonBracket(result.series, 1, random)).toEqual({ kind: '내경기' })
  })

  it('진출 못 한 팀이면 한 번 누름에 우승까지 돌고, 다음 누름이 우승 팀 발표(팝업 7)다', () => {
    const random = createSeededRandom(7)
    const result = pressPostseasonBracket(대진(), 9, random)
    expect(result.kind).toBe('CPU진행')
    if (result.kind !== 'CPU진행') return
    expect(result.series.round).toBe('종료')
    expect(pressPostseasonBracket(result.series, 9, random)).toEqual({
      kind: '우승발표',
      champion: result.series.champion,
    })
  })
})

describe('128 틀 0x15984 — 팝업 닫힘', () => {
  it('팝업 7 뒤 우승 팀이 내 팀이면 팝업 8, 아니면 끝(132)', () => {
    const career = { ...createCareer('우승'), teamId: 4 }
    expect(popupAfterChampion(career, 4)).toEqual({ kind: '한국시리즈우승' })
    expect(popupAfterChampion(career, 5)).toBeNull()
  })

  it('팝업 8 — 인기도 +15 · 평판 +25 · 소지금 +1000만, 상한에서 자른다', () => {
    const career = { ...createCareer('우승'), popularity: 100, reputation: 990, money: 2000 }
    expect(applyKoreanSeriesReward(career)).toMatchObject({ popularity: 115, reputation: 999, money: 3000 })
  })

  it('팝업 0xb — 인기도 +10 · 소지금 +500만 · S+0x77 = 1', () => {
    const career = { ...createCareer('일위'), popularity: 9995, money: 0 }
    const rewarded = applyRegularSeasonReward(career, REGULAR_SEASON_HIDDEN_ID.타자편)
    expect(rewarded).toMatchObject({ popularity: 9999, money: 500, regularSeasonRewardTaken: true })
    expect(rewarded.openedHiddenIds).toEqual([])
  })

  it('정규시즌 1위가 5번째부터(S+0x7a > 4) 타자편은 해금 0x22 를 연다', () => {
    const 네번 = { ...createCareer('일위'), regularSeasonFirstCount: 4 }
    const 다섯번 = { ...createCareer('일위'), regularSeasonFirstCount: 5 }
    expect(applyRegularSeasonReward(네번, REGULAR_SEASON_HIDDEN_ID.타자편).openedHiddenIds).toEqual([])
    expect(applyRegularSeasonReward(다섯번, REGULAR_SEASON_HIDDEN_ID.타자편).openedHiddenIds).toEqual([0x22])
  })

  it('새 시즌 0x1b7c0 이 보상 플래그를 지운다', () => {
    const career = { ...createCareer('일위'), regularSeasonRewardTaken: true }
    expect(startNextSeason(career).regularSeasonRewardTaken).toBe(false)
  })
})
