import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { ACE_BATTER_ROSTER_SLOT } from '@/entities/league/model/leagueDay'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import {
  startPitcherGame,
  withStealPlayLeagueSteals,
  type PitcherGameProgress,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 시작 = startPitcherGame(
  {
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
    repertoire: { pitchMask: 0b101_0111, form: 0, magicNumber: 1 },
    magicCount: 4,
    teamMorale: 80,
    reputation: 500,
    gaugeSettingOn: false,
  },
  createSeededRandom(1),
)

/** 상대 3번 타석에 마타자가 섰고 1루에 2번 타자가 있다 */
const 앞: PitcherGameProgress = {
  ...시작,
  opponentOrderIndex: 2,
  opponentLineup: {
    ...시작.opponentLineup,
    rosterSlots: 시작.opponentLineup.rosterSlots.map((slot, index) => (index === 2 ? ACE_BATTER_ROSTER_SLOT : slot)),
  },
  game: { ...시작.game, bases: { first: true, second: false, third: false }, runners: { first: 1, second: null, third: null } },
  leagueStolenBases: [],
}
const 도루판 = { kind: 5, result: { caughtFrom: [], stolenFrom: [1] } } as unknown as PitchArrivalPlay

describe('B-61 마타자 타석의 도루 (투수편)', () => {
  it('원본: 지금 타자가 마타자라 아무도 안 쌓인다', () => {
    expect(withStealPlayLeagueSteals(앞, 앞, 도루판).leagueStolenBases).toEqual([])
  })

  it('고침: 도루한 주자(2번)에게 쌓인다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-61']))
    expect(withStealPlayLeagueSteals(앞, 앞, 도루판).leagueStolenBases).toEqual([
      { teamId: 1, battingOrderIndex: 시작.opponentLineup.rosterSlots[1] },
    ])
  })
})
