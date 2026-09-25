import { describe, expect, it } from 'vitest'
import {
  ACE_ENTRY_SOUND,
  PITCHER_ENTRY_CRISIS_SOUND,
  PITCHER_ENTRY_SOUND,
  pitcherEntrySoundIdOf,
} from '@/pages/team-game/model/teamGameSounds'

/** 0x38b64 의 투수 가지 — 마선수 → 26 / 2·3루 주자 → 15 / 그 밖 → 14 */
describe('투수 등판음 (0x38b64 → 0x38c34)', () => {
  const 빈루 = { second: false, third: false }

  it('마투수면 26 이다 — 주자가 있어도 마선수가 먼저다 (0x38bf2 가 앞선다)', () => {
    expect(pitcherEntrySoundIdOf({ isAce: true, bases: 빈루 })).toBe(ACE_ENTRY_SOUND)
    expect(pitcherEntrySoundIdOf({ isAce: true, bases: { second: true, third: false } })).toBe(
      ACE_ENTRY_SOUND,
    )
  })

  it('2루나 3루에 주자가 있으면 15 다 (0xa97a0(필드, 2|3))', () => {
    expect(pitcherEntrySoundIdOf({ isAce: false, bases: { second: true, third: false } })).toBe(
      PITCHER_ENTRY_CRISIS_SOUND,
    )
    expect(pitcherEntrySoundIdOf({ isAce: false, bases: { second: false, third: true } })).toBe(
      PITCHER_ENTRY_CRISIS_SOUND,
    )
  })

  it('1루만 차 있거나 빈 루면 14 다', () => {
    expect(pitcherEntrySoundIdOf({ isAce: false, bases: 빈루 })).toBe(PITCHER_ENTRY_SOUND)
  })
})
