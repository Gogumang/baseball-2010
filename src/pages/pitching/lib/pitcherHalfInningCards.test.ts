import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { startPitcherGame, opponentBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { pitcherHalfInningCardsOf } from '@/pages/pitching/lib/pitcherHalfInningCards'

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

describe('나리 투수편 교대 판 두 팀 판 값 (0x420dc · 0x42364)', () => {
  it('1회초 판 — PITCHER 는 내 투수, DUE UP 은 상대 타순 1·2·3', () => {
    const progress = startPitcherGame(기본옵션, createSeededRandom(20100901))
    expect(progress.halfInningBoard).not.toBeNull()
    const cards = pitcherHalfInningCardsOf(progress, '나투수', '초')
    expect(cards.battingSide).toBe(0)
    expect(cards.pitcherName).toBe('나투수')
    expect(cards.currentOrder).toBe(0)
    expect(cards.dueUpNames).toEqual([0, 1, 2].map(
      (slot) => opponentBatterOf({ ...progress, opponentOrderIndex: slot }).name,
    ))
    expect(cards.dueUpNames.every((name) => typeof name === 'string')).toBe(true)
    expect(pitcherHalfInningCardsOf(progress, undefined, '초').pitcherName).toBeNull()
  })
})
