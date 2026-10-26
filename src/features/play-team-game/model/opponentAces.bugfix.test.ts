import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { rollOpponentAces, rollTeamSetup } from '@/features/play-team-game/model/teamGameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-03 사람이 마선수 "없음"이어도 CPU 가 마선수를 받음 (0x66968 · 0x66994 ldrb)', () => {
  it('원본: 없음(−1)이어도 AI 는 0~4 를 받는다', () => {
    const aces = rollOpponentAces(-1, -1, createSeededRandom(7))
    expect(aces.pitcher).toBeGreaterThanOrEqual(0)
    expect(aces.batter).toBeGreaterThanOrEqual(0)
  })

  it('고침: 사람이 안 고른 역할은 AI 도 없음 — 굴림 수는 같아 선발 굴림이 원본과 같다', () => {
    const 원본 = rollTeamSetup(-1, 2, createSeededRandom(7))
    setBugfixConfigForTests(bugfixConfigWith(['B-03']))
    const 고침 = rollTeamSetup(-1, 2, createSeededRandom(7))
    expect(고침.opponentAces).toEqual({ pitcher: -1, batter: 원본.opponentAces.batter })
    expect(고침.startingPitcherSlots).toEqual(원본.startingPitcherSlots)
    // 둘 다 고르면 원본과 같다
    expect(rollOpponentAces(1, 3, createSeededRandom(9))).toEqual((() => {
      setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG)
      return rollOpponentAces(1, 3, createSeededRandom(9))
    })())
  })
})
