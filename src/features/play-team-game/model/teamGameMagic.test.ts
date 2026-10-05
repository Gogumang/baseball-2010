import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ENTRY_ACE_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import {
  availablePitchers,
  changePitcher,
  isPitchTurn,
  startTeamGame,
  startThrowPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'

const 기본옵션: TeamGameOptions = {
  mode: 1,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
}

const 시작 = (options: Partial<TeamGameOptions> = {}, seed = 20100901) =>
  startTeamGame({ ...기본옵션, opponentAces: { pitcher: -1, batter: -1 }, ...options }, createSeededRandom(seed))

const 마구 = { typeNumber: 22, courseCell: 4, gaugeCell: 0 }

describe('우리 팀 마구 횟수 팀+0x28 — 0xaebe4 가 마운드에 오른 투수로 채운다', () => {
  it('로스터 투수는 +0x18 == 0 이라 0 — 마구 칸이 없다', () => {
    expect(시작().magicRemaining).toBe(0)
  })

  it('마투수가 교체로 오르면 0xd8509[레벨] = 3,4,5,6,7 (레벨 = mgr[0x13a + 순번])', () => {
    const progress = 시작({ acePitcherId: 2 })
    expect(availablePitchers(progress)).toContain(PITCHER_ENTRY_ACE_SLOT)
    expect(changePitcher(progress, PITCHER_ENTRY_ACE_SLOT).magicRemaining).toBe(3)
    const 레벨4 = 시작({ acePitcherId: 2, aceLevels: { 2: 4 } })
    expect(changePitcher(레벨4, PITCHER_ENTRY_ACE_SLOT).magicRemaining).toBe(7)
    // 다른 마투수 칸의 레벨은 안 본다
    const 남의칸 = 시작({ acePitcherId: 2, aceLevels: { 1: 4, 7: 4 } })
    expect(changePitcher(남의칸, PITCHER_ENTRY_ACE_SLOT).magicRemaining).toBe(3)
  })

  it('마투수가 마구를 던지면 줄고, 일반 투수로 바꾸면 0 — 남은 횟수는 버려지고 내려간 투수는 다시 못 오른다', () => {
    const progress = changePitcher(시작({ acePitcherId: 0, aceLevels: { 0: 1 } }), PITCHER_ENTRY_ACE_SLOT)
    expect(progress.magicRemaining).toBe(4)
    expect(isPitchTurn(progress)).toBe(true)
    const 던짐 = startThrowPitch(progress, 마구, createSeededRandom(3))
    expect(던짐.magicRemaining).toBe(3)
    // 마투수 +0x18 = 순번 + 5 — 공+0x10 에 실린다
    expect(던짐.lastPitch?.magicNumber).toBe(5)
    if (!isPitchTurn(던짐)) return
    const 벤치 = availablePitchers(던짐)
    expect(벤치).not.toContain(PITCHER_ENTRY_ACE_SLOT)
    const 교체 = changePitcher(던짐, 벤치[0]!)
    expect(교체.magicRemaining).toBe(0)
    expect(availablePitchers(교체)).not.toContain(PITCHER_ENTRY_ACE_SLOT)
  })

  it('일반 투수는 구질 22 를 던질 수 없다 (0x50db8 — 남은 0 이면 무시)', () => {
    const progress = 시작()
    expect(startThrowPitch(progress, 마구, createSeededRandom(3))).toBe(progress)
  })
})
