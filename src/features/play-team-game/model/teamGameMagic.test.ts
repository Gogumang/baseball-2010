import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ENTRY_ACE_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import {
  applyBatterPitch,
  availablePitchers,
  changePitcher,
  isBatterTurn,
  isPitchTurn,
  opponentMagicStateOf,
  startTeamGame,
  startThrowPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

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

describe('공 객체는 경기에 하나 — 사람 투구와 CPU 투구가 공+0x10 을 함께 쓴다 (경기+0xf98)', () => {
  const 공 = (pitchTypeNumber: number) => ({
    resolution: { kind: '볼' } as const,
    hasSwung: false,
    isBunt: false,
    resultCode: null,
    pitchTypeNumber,
  })

  /** 우리 공격 · 상대 투수를 마투수(레오니, +0x18 = 6)로 바꿔 세운 판 */
  function 상대마투수(ballMagicNumber: number): TeamGameProgress {
    const base = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    return {
      ...base,
      opponentPitcherEntry: base.opponentPitcherEntry.map((pitcher, slot) =>
        slot === base.opponentPitcherIndex
          ? { ...pitcher, aceIndex: 1, repertoire: { ...pitcher.repertoire, magicId: 6 } }
          : pitcher,
      ),
      opponentMagicRemaining: 3,
      ballMagicNumber,
    }
  }

  it('상대 로스터 투수는 남은 0 — 타석 화면은 진행기 값을 받는다', () => {
    const progress = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    expect(opponentMagicStateOf(progress)).toEqual({ remaining: 0, ballMagicNumber: 0 })
  })

  it('공이 비어 있으면 CPU 의 첫 마구는 소모되지 않는다 (0x345fc 의 공+0x10 ≠ 0 조건) — 그 뒤로는 준다', () => {
    const progress = 상대마투수(0)
    expect(isBatterTurn(progress)).toBe(true)
    const 첫 = applyBatterPitch(progress, 공(22), createSeededRandom(1))
    expect(첫.opponentMagicRemaining).toBe(3)
    expect(첫.ballMagicNumber).toBe(6)
    const 둘 = applyBatterPitch(첫, 공(22), createSeededRandom(1))
    expect(둘.opponentMagicRemaining).toBe(2)
    // 직구는 공+0x10 을 안 지운다 (0x3de10 만 쓴다)
    const 직구 = applyBatterPitch(둘, 공(1), createSeededRandom(1))
    expect(직구.opponentMagicRemaining).toBe(2)
    expect(직구.ballMagicNumber).toBe(6)
  })

  it('사람이 먼저 마구를 던져 공에 번호가 남아 있으면 CPU 의 첫 마구도 소모된다 — 공 칸은 CPU 번호로 바뀐다', () => {
    const 첫 = applyBatterPitch(상대마투수(2), 공(22), createSeededRandom(1))
    expect(첫.opponentMagicRemaining).toBe(2)
    expect(첫.ballMagicNumber).toBe(6)
    expect(opponentMagicStateOf(첫)).toEqual({ remaining: 2, ballMagicNumber: 6 })
  })

  it('CPU 마구 뒤 사람 공에도 그 공+0x10 이 남는다 — 사람이 마구를 안 던져도 0x34d6c 투수 쪽이 선다', () => {
    const 공남음 = { ...시작(), ballMagicNumber: 6 }
    expect(isPitchTurn(공남음)).toBe(true)
    const 직구 = startThrowPitch(공남음, { typeNumber: 1, courseCell: 4, gaugeCell: 0 }, createSeededRandom(3))
    expect(직구.lastPitch?.magicNumber).toBe(6)
    expect(직구.ballMagicNumber).toBe(6)
  })
})
