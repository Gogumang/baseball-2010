import { describe, expect, it } from 'vitest'
import { EMPTY_LEAGUE, startPostseason } from '@/entities/league/model/league'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import {
  POSTSEASON_RANK_TEXT, nationalCupMatchInfoRankOf, seasonMatchInfoLines,
} from '@/pages/season/lib/seasonMatchInfo'
import type { SeasonMatchInfoInput } from '@/pages/season/lib/seasonMatchInfo'

const 기본: SeasonMatchInfoInput = {
  league: EMPTY_LEAGUE, series: null, cup: null, inPostseason: false,
  myTeamId: 0, opponentTeamId: 1, dayCounter: 0, acePitcherId: -1, aceBatterId: -1,
}

describe('시즌 경기정보 값 줄 (0x5dcc0 모드 2)', () => {
  it('정규시즌 — 순위는 숫자만, 승패는 "%d승%d패", 선발은 그날 로테이션 칸', () => {
    const league = { ...EMPTY_LEAGUE, wins: EMPTY_LEAGUE.wins.map((_w, team) => (team === 1 ? 3 : 0)),
      losses: EMPTY_LEAGUE.losses.map((_l, team) => (team === 0 ? 2 : 0)) }
    const [순위, 승패, 선발, 마투수, 마타자] = seasonMatchInfoLines({ ...기본, league, dayCounter: 5 })
    expect(순위).toMatchObject({ user: expect.stringMatching(/^\d+$/), cpu: '1' })
    expect(승패).toMatchObject({ user: '0승2패', cpu: '3승0패' })
    expect(선발.user).toBe(teamPitchers(0)[1]?.name)
    expect(마투수).toMatchObject({ user: '-', cpu: '-' })
    expect(마타자).toMatchObject({ user: '-', cpu: '-' })
  })

  it('포스트시즌이면 순위 칸이 "--" 이고 승패는 이번 시리즈다 (0xb7908 L+0x34 갈래)', () => {
    const series = { ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), wins: [1, 2] as const }
    const [순위, 승패] = seasonMatchInfoLines({ ...기본, series, inPostseason: true, myTeamId: 2, opponentTeamId: 3 })
    expect(순위).toMatchObject({ user: POSTSEASON_RANK_TEXT, cpu: POSTSEASON_RANK_TEXT })
    expect(승패).toMatchObject({ user: '1승2패', cpu: '2승1패' })
  })

  it('국가대항전 순위 0xb834c 는 넷째 칸(미국)을 한 번도 견주지 않는다 — 원본 그대로', () => {
    const cup = { ...createNationalCup(), wins: [0, 0, 0, 3], losses: [3, 1, 1, 0] }
    expect(nationalCupMatchInfoRankOf(cup, 13)).toBe(3)
    // 일본·쿠바(0승1패)가 대한민국(0승3패)보다 앞선다
    expect(nationalCupMatchInfoRankOf(cup, 10)).toBe(2)
  })
})
