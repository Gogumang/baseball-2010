import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA, staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { startPitcherGame, opponentBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { leagueBatterIdOf } from '@/entities/league/model/leaguePlayerStats'
import { pitcherMatchupCardsOf } from '@/pages/pitching/lib/pitcherMatchupCards'

const 기본옵션: PitcherGameOptions = {
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  role: PITCHER_ROLE.starter,
  positionCode: 0,
  dayCounter: 2,
  isPostseason: false,
  stats: { control: 500, velocity: 500, breaking: 500, stamina: 400 },
  staminaAbility: 400,
  stamina: FULL_STAMINA,
  repertoire: { pitchMask: 0b101_0111, form: 1, magicNumber: 1 },
  magicCount: 4,
  teamMorale: 80,
  reputation: 500,
  gaugeSettingOn: false,
}

describe('나리 투수편 상태 0xe 소개 판 값 (0x44944)', () => {
  it('투수 = 나(PLAYER): 보직·손(폼 & 1)·체력 막대 / 타자 = 상대(COM): 이름·수비·타순', () => {
    const progress = startPitcherGame(기본옵션, createSeededRandom(20100901))
    const { pitcher, batter } = pitcherMatchupCardsOf(progress, '나투수')
    expect(pitcher).toMatchObject({ isComputer: false, name: '나투수', role: 0, throwsLeft: true })
    // 선발이라 첫 투수 — 용량 +200 · 최대 1449
    expect(pitcher.stamina).toEqual({ lengthValue: staminaCapacityOf(400, 80, true), maxValue: 1449, percent: 100 })
    const opponent = opponentBatterOf(progress)
    expect(batter).toMatchObject({ isComputer: true, name: opponent.name, battingOrder: progress.opponentOrderIndex % 9 })
    expect(pitcher.earnedRunAverage).toBeUndefined()
  })

  it('시즌 줄을 주면 내 줄 + 이 경기 · 상대 타자는 리그 기록표 줄 + 이 경기 링', () => {
    const progress = startPitcherGame(기본옵션, createSeededRandom(20100901))
    const opponent = opponentBatterOf(progress)
    const stats = {
      batters: { [leagueBatterIdOf(1, opponent.rosterSlot!)]: { atBats: 50, hits: 15, homeRuns: 3, runsBattedIn: 8 } },
    }
    const { pitcher, batter } = pitcherMatchupCardsOf(progress, '나투수', {
      mySeason: { outs: 54, runsAllowed: 4, strikeouts: 12 },
      stats,
    })
    expect(pitcher.earnedRunAverage).toBe(Math.trunc(((4 + progress.runsAllowedByMe) * 2700) / (54 + progress.record.outsRecorded)))
    expect(pitcher.strikeouts).toBe(12 + progress.record.strikeouts)
    expect(batter.battingAverage).toBeGreaterThan(0)
    expect(batter.runsBattedIn).toBe(8)
  })

  it('국가대항전 경기면 게이트 0xa56dc 가 거짓이라 이 경기 줄을 더하지 않는다 (포스트시즌과 같다)', () => {
    const started = startPitcherGame({ ...기본옵션, isNationalCup: true }, createSeededRandom(20100901))
    const progress = {
      ...started,
      runsAllowedByMe: 2,
      record: { ...started.record, outsRecorded: 6, strikeouts: 3 },
    }
    const { pitcher } = pitcherMatchupCardsOf(progress, '나투수', {
      mySeason: { outs: 54, runsAllowed: 4, strikeouts: 12 },
      stats: { batters: {} },
    })
    expect(pitcher.strikeouts).toBe(12)
    expect(pitcher.earnedRunAverage).toBe(Math.trunc((4 * 2700) / 54))
  })
})
