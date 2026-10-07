import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  applyBatterOutcome,
  confirmScene,
  moundStaminaOf,
  startTeamGame,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { staminaCapacityOf, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { BATTERS } from '@/shared/config/original/roster'
import { leagueBatterIdOf, leaguePitcherIdOf } from '@/entities/league/model/leaguePlayerStats'
import { teamMatchupCardsOf } from '@/pages/team-game/lib/teamMatchupCards'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

describe('팀경기 상태 0xe 소개 판 값 (0x44944)', () => {
  it('우리가 던지면 투수 PLAYER — 이름·보직·손(0xb63c0)·체력 막대(0x66e44 / 1449 · 0xaebb0)를 지금 마운드에서 읽는다', () => {
    const progress = startTeamGame(기본옵션, createSeededRandom(1))
    const { pitcher, batter } = teamMatchupCardsOf(progress)
    const entry = progress.ourPitcherEntry[progress.ourPitcherIndex]!
    expect(pitcher.isComputer).toBe(false)
    expect(batter.isComputer).toBe(true)
    expect(pitcher.name).toBe(entry.name)
    expect(pitcher.throwsLeft).toBe(pitcherHandOf(entry.repertoire.form, entry.aceIndex >= 0) === 1)
    const mound = moundStaminaOf(progress, true)
    expect(pitcher.stamina).toEqual({
      lengthValue: staminaCapacityOf(mound.staminaAbility, mound.teamMorale, true),
      // 아직 교체가 없다 (팀[+0x26] − 팀[+0x33] == 1) → 1449
      maxValue: 1449,
      percent: staminaPercentOf(progress.stamina),
    })
    // 시즌 줄 출처를 안 주면 비운다
    expect(pitcher.earnedRunAverage).toBeUndefined()
    expect(batter.battingAverage).toBeUndefined()
  })

  it('타자 손은 레코드 +0xb 폼 니블의 낮은 비트, 오늘 타석 기록은 그 타순 칸 링이다', () => {
    const random = createSeededRandom(3)
    let progress = startTeamGame({ ...기본옵션, playerSide: PLAYER_SIDE_FIRST_BAT }, random)
    progress = confirmScene(progress, random)
    const first = teamMatchupCardsOf(progress)
    const entry = progress.ourEntry[progress.game.battingOrderIndex]!
    const profile = BATTERS[leagueBatterIdOf(0, entry.rosterSlot)]!.profile
    expect(first.batterHand).toBe((profile >> 4) & 1)
    expect(first.batter.recentResults).toEqual([])
    const slot = progress.game.battingOrderIndex
    const after = applyBatterOutcome(progress, { kind: '삼진' }, random)
    // 같은 칸이 다시 타석에 서면(아홉 타자 뒤) 링에 삼진 7 이 남아 있다
    expect(after.ourEntryRecords[slot]?.results).toEqual([7])
  })

  it('시즌 줄은 리그 기록표 줄 + 이 경기 줄 — 방어율 0xb6ce8 · 탈삼진 · 타율 0xb8e3c · 홈런 · 타점', () => {
    const progress = startTeamGame(기본옵션, createSeededRandom(1))
    const entry = progress.ourPitcherEntry[progress.ourPitcherIndex]!
    const batterEntry = progress.opponentEntry[progress.opponentOrderIndex]!
    const stats = {
      batters: { [leagueBatterIdOf(1, batterEntry.rosterSlot)]: { atBats: 40, hits: 13, homeRuns: 2, runsBattedIn: 9 } },
      pitchers: {
        [leaguePitcherIdOf(0, entry.tableSlot!)]: {
          outs: 81, runsAllowed: 10, saves: 0, strikeouts: 22, pitches: 300, wins: 2, losses: 1,
        },
      },
    }
    const { pitcher, batter } = teamMatchupCardsOf(progress, { stats, countsThisGame: true })
    // 10 × 2700 / 81 = 333 → 3.33
    expect(pitcher.earnedRunAverage).toBe(333)
    expect(pitcher.strikeouts).toBe(22)
    // 13 × 1000 / 40 = 325
    expect(batter.battingAverage).toBe(325)
    expect(batter.homeRuns).toBe(2)
    expect(batter.runsBattedIn).toBe(9)
  })
})
