import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { opponentMoundOf, startGame } from '@/features/play-game/model/gameFlow'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { gameHalfInningCardsOf } from '@/pages/game/lib/gameHalfInningCards'

describe('나리 타자편 교대 판 두 팀 판 값 (0x420dc · 0x42364)', () => {
  it('1회초 판 — PITCHER 는 상대 마운드, DUE UP 은 내 팀 타순 1·2·3 (1번 칸은 내 선수)', () => {
    const progress = startGame(createSeededRandom(3), 0, 1, undefined, PLAYER_SIDE_FIRST_BAT)
    expect(progress.halfInningBoard).not.toBeNull()
    const cards = gameHalfInningCardsOf(progress, createCareer('나리'), '초')
    expect(cards.battingSide).toBe(0)
    expect(cards.count).toEqual({ strikes: 0, balls: 0, outs: 0 })
    expect(cards.pitcherName).toBe(opponentMoundOf(progress).name)
    expect(cards.currentOrder).toBe(0)
    const roster = teamBatters(0)
    expect(cards.dueUpNames).toEqual(['나리', roster[1]?.name, roster[2]?.name])
  })
})
