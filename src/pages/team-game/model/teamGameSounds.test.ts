import { describe, expect, it } from 'vitest'
import {
  ACE_ENTRY_SOUND,
  PITCHER_ENTRY_CRISIS_SOUND,
  PITCHER_CHANGE_SOUND,
  PITCHER_ENTRY_SOUND,
  pinchHitSoundIdsOf,
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

/** 대타가 교체 연출 0x16 을 지날 때 — 0xf 진입 22(3da88) · 0x38b64 타자 가지(38cd4) */
describe('대타 교체 소리 (pinchHitSoundIdsOf)', () => {
  const 진행 = (
    scenePinchHit: { serial: number; by: '사람' | 'CPU'; incomingIsAce: boolean } | null,
    bases = { second: false, third: false },
  ) => ({ scenePinchHit, game: { bases } })

  it('사람 대타는 등판음만 — 22 는 # 창을 열 때 이미 났다', () => {
    expect(pinchHitSoundIdsOf(진행(null), 진행({ serial: 1, by: '사람', incomingIsAce: false }))).toEqual([PITCHER_ENTRY_SOUND])
  })

  it('CPU 대타는 22 다음 등판음 — 마타자 26 · 2·3루 주자 15', () => {
    expect(pinchHitSoundIdsOf(진행(null), 진행({ serial: 1, by: 'CPU', incomingIsAce: true }))).toEqual([
      PITCHER_CHANGE_SOUND,
      ACE_ENTRY_SOUND,
    ])
    expect(
      pinchHitSoundIdsOf(진행(null), 진행({ serial: 1, by: 'CPU', incomingIsAce: false }, { second: false, third: true })),
    ).toEqual([PITCHER_CHANGE_SOUND, PITCHER_ENTRY_CRISIS_SOUND])
  })

  it('교체가 없던 걸음에는 아무 소리도 없다', () => {
    const 같은 = { serial: 2, by: 'CPU' as const, incomingIsAce: false }
    expect(pinchHitSoundIdsOf(진행(같은), 진행(같은))).toEqual([])
    expect(pinchHitSoundIdsOf(진행(null), 진행(null))).toEqual([])
  })
})
