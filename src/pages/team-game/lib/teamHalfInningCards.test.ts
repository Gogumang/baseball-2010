import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { startTeamGame } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { teamHalfInningCardsOf } from '@/pages/team-game/lib/teamHalfInningCards'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

describe('팀경기 교대 판 두 팀 판 값 (0x420dc · 0x42364)', () => {
  it('후공 1회초 — PITCHER 는 우리 마운드, DUE UP 은 상대 타순 칸 셋', () => {
    const progress = startTeamGame(기본옵션, createSeededRandom(1))
    const cards = teamHalfInningCardsOf(progress, '초')
    expect(cards.battingSide).toBe(0)
    expect(cards.count).toEqual({ strikes: 0, balls: 0, outs: 0 })
    expect(cards.pitcherName).toBe(progress.ourPitcherEntry[progress.ourPitcherIndex]?.name)
    expect(cards.currentOrder).toBe(progress.opponentOrderIndex % 9)
    expect(cards.dueUpNames).toEqual([0, 1, 2].map((row) => progress.opponentEntry[(cards.currentOrder + row) % 9]?.name))
  })

  it('선공 1회초 — PITCHER 는 상대 마운드, DUE UP 은 우리 명단(내 선수 칸 포함)', () => {
    const progress = startTeamGame({ ...기본옵션, playerSide: PLAYER_SIDE_FIRST_BAT }, createSeededRandom(1))
    const cards = teamHalfInningCardsOf(progress, '초')
    expect(cards.pitcherName).toBe(progress.opponentPitcherEntry[progress.opponentPitcherIndex]?.name)
    expect(cards.dueUpNames).toEqual([0, 1, 2].map((row) => progress.ourEntry[(cards.currentOrder + row) % 9]?.name))
    expect(cards.dueUpNames.every((name) => typeof name === 'string')).toBe(true)
  })
})
