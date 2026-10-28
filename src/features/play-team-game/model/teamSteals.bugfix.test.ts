import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { startTeamGame, withLeagueStolenBases, type TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 시작 = startTeamGame(
  { mode: 2, ourTeamId: 0, opponentTeamId: 1, playerSide: PLAYER_SIDE_LAST_BAT, season: { illness: 0, morale: 100, coach: -1 } },
  createSeededRandom(1),
)

/** 우리 4번 타석에 마타자가 섰고 1루에 3번 타자가 있다 */
const 앞: TeamGameProgress = {
  ...시작,
  ourEntry: 시작.ourEntry.map((batter, index) => (index === 3 ? { ...batter, aceIndex: 1 } : batter)),
  game: {
    ...시작.game,
    battingOrderIndex: 3,
    bases: { first: true, second: false, third: false },
    runners: { first: 2, second: null, third: null },
  },
  leagueStolenBases: [],
}
const 도루판 = { kind: 5, result: { caughtFrom: [], stolenFrom: [1] } } as unknown as PitchArrivalPlay

describe('B-61 마타자 타석의 도루 (팀 경기)', () => {
  it('원본: 지금 타자가 마타자라 아무도 안 쌓인다', () => {
    expect(withLeagueStolenBases(앞, 앞, 도루판, true).leagueStolenBases).toEqual([])
  })

  it('고침: 도루한 주자(3번)에게 쌓인다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-61']))
    const 쌓임 = withLeagueStolenBases(앞, 앞, 도루판, true).leagueStolenBases ?? []
    expect(쌓임).toHaveLength(1)
    expect(쌓임[0]?.battingOrderIndex).toBe(시작.ourEntry[2]?.rosterSlot)
  })
})
