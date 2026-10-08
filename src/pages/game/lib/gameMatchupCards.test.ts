import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { applyPlayerOutcome, opponentMoundOf, startGame } from '@/features/play-game/model/gameFlow'
import { staminaCapacityOf, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { leaguePitcherIdOf } from '@/entities/league/model/leaguePlayerStats'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { gameMatchupCardsOf } from '@/pages/game/lib/gameMatchupCards'

describe('나리 타자편 상태 0xe 소개 판 값 (0x44944)', () => {
  it('투수 = 상대 마운드(이름·보직·체력 막대), 타자 = 내 선수(타순·손·시즌 줄 + 이 경기)', () => {
    const progress = startGame(createSeededRandom(20100902))
    const career = createCareer('나리')
    const { pitcher, batter, batterHand } = gameMatchupCardsOf(progress, career)
    const mound = opponentMoundOf(progress)
    expect(pitcher.isComputer).toBe(true)
    expect(pitcher.name).toBe(teamPitchers(progress.opponentTeamId)[progress.opponentMound.pitcherSlot]?.name)
    expect(pitcher.stamina).toEqual({
      lengthValue: staminaCapacityOf(mound.staminaAbility, mound.teamMorale, true),
      maxValue: 1449,
      percent: staminaPercentOf(progress.opponentMound.stamina),
    })
    // 시즌 줄이 비어 있으면 0.00 · 0
    expect(pitcher.earnedRunAverage).toBe(0)
    expect(batter.isComputer).toBe(false)
    expect(batter.name).toBe('나리')
    expect(batter.battingOrder).toBe(career.battingOrder - 1)
    expect(batterHand).toBe(career.battingSide)
    expect(batter.battingAverage).toBe(0)
    expect(batter.recentResults).toEqual([])
  })

  it('리그 기록표 투수 줄과 이 경기 내 타석이 판에 들어간다 — 내 타순 칸 링에 결과가 쌓인다', () => {
    const random = createSeededRandom(20100901)
    const progress = startGame(random)
    const slot = progress.opponentMound.pitcherSlot
    const base = createCareer('나리')
    const career = {
      ...base,
      stats: { ...base.stats, atBats: 9, hits: 3, homeRuns: 1, runsBattedIn: 2 },
      leaguePlayerStats: {
        ...base.leaguePlayerStats,
        pitchers: {
          [leaguePitcherIdOf(progress.opponentTeamId, slot)]: {
            outs: 27, runsAllowed: 3, saves: 0, strikeouts: 7, pitches: 100, wins: 1, losses: 0,
          },
        },
      },
    }
    const before = gameMatchupCardsOf(progress, career)
    // 경기를 세우며 이미 지난 반 이닝에서 그 투수가 쌓은 줄도 더한다 (게이트가 열린 정규시즌)
    const 이경기 = progress.pitcherLines.find((line) => line.teamId === progress.opponentTeamId && line.pitcherSlot === slot)
    const outs = 27 + (이경기?.outs ?? 0)
    const runs = 3 + (이경기?.runsAllowed ?? 0)
    expect(before.pitcher.earnedRunAverage).toBe(Math.min(9999, Math.trunc((runs * 2700) / outs)))
    expect(before.pitcher.strikeouts).toBe(7 + (이경기?.strikeouts ?? 0))
    // 포스트시즌이면 이 경기 줄을 안 더한다 (0xa56dc 0xa571c)
    const 포스트시즌 = gameMatchupCardsOf(progress, { ...career, postseason: {} as never })
    expect(포스트시즌.pitcher.earnedRunAverage).toBe(300)
    expect(before.batter.battingAverage).toBe(333)
    expect(before.batter.homeRuns).toBe(1)

    const after = applyPlayerOutcome(progress, { kind: '홈런' }, random)
    const myRecords = after.ourLineup.records[progress.game.battingOrderIndex % 9]
    expect(myRecords?.results).toEqual([4])
  })
})
