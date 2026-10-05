import { describe, expect, it } from 'vitest'
import { leagueDayCounterOf, leagueGamePlayerSideOf } from '@/entities/career/model/leagueGameSetup'
import { advancePostseason, opponentOf, startPostseason } from '@/entities/league/model/league'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'

const 정규시즌 = (teamId: number, gamesPlayed: number) => ({ teamId, gamesPlayed, postseason: null })

describe('경기 준비 0x1c46c 의 측 — 0xb7844(L, 내 팀)', () => {
  it('정규시즌: 짝 중 번호가 작은 팀이 첫 9일 홈(후공), 큰 팀이 원정(선공)이다', () => {
    // 0일째 0 대 1 — 0 이 홈
    expect(opponentOf(0, 0)).toBe(1)
    expect(leagueGamePlayerSideOf(정규시즌(0, 0))).toBe(PLAYER_SIDE_LAST_BAT)
    expect(leagueGamePlayerSideOf(정규시즌(1, 0))).toBe(PLAYER_SIDE_FIRST_BAT)
  })

  it('정규시즌: 9일 한 바퀴마다 뒤집히고, g > 22 면 한 번 더 뒤집힌다 (b7872~b78d4)', () => {
    // 9일째(두 번째 바퀴) 0 대 1 — 뒤집혀 0 이 원정
    expect(opponentOf(9, 0)).toBe(1)
    expect(leagueGamePlayerSideOf(정규시즌(0, 9))).toBe(PLAYER_SIDE_FIRST_BAT)
    // 18일째(세 번째 바퀴) — 다시 홈
    expect(leagueGamePlayerSideOf(정규시즌(0, 18))).toBe(PLAYER_SIDE_LAST_BAT)
    // 27일째(네 번째 바퀴, g > 22) — 홀짝으로는 원정이지만 한 번 더 뒤집혀 홈
    expect(leagueGamePlayerSideOf(정규시즌(0, 27))).toBe(PLAYER_SIDE_LAST_BAT)
  })

  it('포스트시즌: 대진 윗 시드(칸 0)가 후공, 아랫 시드(칸 1)가 선공 — g 는 보지 않는다', () => {
    const series = startPostseason([0, 1, 2, 3])
    expect(leagueGamePlayerSideOf({ teamId: 2, gamesPlayed: 46, postseason: series })).toBe(PLAYER_SIDE_LAST_BAT)
    expect(leagueGamePlayerSideOf({ teamId: 3, gamesPlayed: 46, postseason: series })).toBe(PLAYER_SIDE_FIRST_BAT)
  })
})

describe('날짜 카운터 g = L+0x32', () => {
  it('정규시즌은 치른 경기 수다', () => {
    expect(leagueDayCounterOf(정규시즌(4, 17))).toBe(17)
  })

  it('포스트시즌은 그 시리즈에서 치른 경기 수 — 시리즈가 바뀌면 0 (b811c · b777a · b819a)', () => {
    const 준PO = startPostseason([0, 1, 2, 3])
    expect(leagueDayCounterOf({ teamId: 2, gamesPlayed: 45, postseason: 준PO })).toBe(0)
    const 둘째 = advancePostseason(advancePostseason(준PO, 2), 3)
    expect(leagueDayCounterOf({ teamId: 2, gamesPlayed: 47, postseason: 둘째 })).toBe(2)
    const PO = advancePostseason(advancePostseason(둘째, 2), 2)
    expect(PO.round).toBe('플레이오프')
    expect(leagueDayCounterOf({ teamId: 2, gamesPlayed: 49, postseason: PO })).toBe(0)
  })

  it('한국시리즈가 끝난 대진은 0 이다 — 0xb7724 −1 뒤 하루 끝 +1', () => {
    const 끝 = { ...startPostseason([0, 1, 2, 3]), round: '종료' as const, wins: [4, 2] as const, champion: 0 }
    expect(leagueDayCounterOf({ teamId: 0, gamesPlayed: 60, postseason: 끝 })).toBe(0)
  })
})
