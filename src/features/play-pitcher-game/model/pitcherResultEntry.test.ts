import { describe, expect, it } from 'vitest'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherGameOptions, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { enterPitchResult, isPitchTurn, pickoff, startPitch, startPitcherGame } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import {
  enterPitchResult as enterTeamPitchResult,
  isPitchTurn as isTeamPitchTurn,
  startTeamGame,
  startThrowPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

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
  repertoire: { pitchMask: 0b101_0111, form: 0, magicNumber: 1 },
  magicCount: 4,
  teamMorale: 80,
  reputation: 500,
  gaugeSettingOn: false,
}

/** 굴린 수를 세는 난수 */
function 센난수(seed: number): RandomPort & { readonly drawn: () => number } {
  const base = createSeededRandom(seed)
  let count = 0
  return {
    ...base,
    rand: (lo: number, hi: number) => {
      count += 1
      return base.rand(lo, hi)
    },
    drawn: () => count,
  }
}

/**
 * Q-04 ② (r293) — 화면 갈래(`holdsArrival`)는 못 맞힌 공의 공 도착 0x3dfac(`rollPassedBall` · 판 시작 굴림)을 0x12 진입 틀까지 붙든다.
 * 그 사이 굴림이 없으면 놓는 걸음에 다 돌린 것과 결과 · 굴림 수가 같다 — 그 사이 굴림(관리자 틱)은 0x3dfac 앞으로 간다.
 */
describe('공 도착 0x3dfac 을 0x12 진입 틀로 — 투수편 `enterPitchResult`', () => {
  it('못 맞힌 공은 붙들고(굴림 1 번 덜), 진입에서 놓는 걸음 한 번과 같은 상태가 된다', () => {
    let 확인 = 0
    for (let seed = 1; seed <= 40 && 확인 < 5; seed += 1) {
      const progress = startPitcherGame(기본옵션, createSeededRandom(seed))
      if (!isPitchTurn(progress)) continue
      const 한번 = 센난수(seed * 7)
      const 붙듦난수 = 센난수(seed * 7)
      const 다돔 = startPitch(progress, { typeNumber: 1, gaugeCell: 0 }, 한번, true)
      const 붙듦 = startPitch(progress, { typeNumber: 1, gaugeCell: 0 }, 붙듦난수, true, true)
      if (붙듦.pendingPitchArrival == null) {
        // 맞은 공 — 0x3dfac 을 안 지나 그대로다(판 입력은 난수 포트를 쥐어 판정 · 굴림 수로 본다)
        expect(붙듦.lastResolution).toEqual(다돔.lastResolution)
        expect(붙듦난수.drawn()).toBe(한번.drawn())
        continue
      }
      // 0x3dfac 의 rollPassedBall(모드 3) 은 아직이다
      expect(붙듦난수.drawn()).toBeLessThan(한번.drawn())
      expect(isPitchTurn(붙듦)).toBe(true)
      // 붙든 동안 다음 공 · 견제는 없다
      expect(startPitch(붙듦, { typeNumber: 1, gaugeCell: 0 }, 붙듦난수, true, true)).toBe(붙듦)
      expect(pickoff(붙듦, '3', 붙듦난수, true)).toBe(붙듦)
      const 진입: PitcherGameProgress = enterPitchResult(붙듦, 붙듦난수)
      expect(진입.pendingPitchArrival).toBeNull()
      expect({ ...진입, pendingPitchArrival: undefined }).toEqual({ ...다돔, pendingPitchArrival: undefined })
      expect(붙듦난수.drawn()).toBe(한번.drawn())
      expect(enterPitchResult(진입, 붙듦난수)).toBe(진입)
      확인 += 1
    }
    expect(확인).toBeGreaterThan(0)
  })
})

describe('공 도착 0x3dfac 을 0x12 진입 틀로 — 팀경기 `enterPitchResult`', () => {
  it('우리 공(사람 수비)도 같다', () => {
    let 확인 = 0
    for (let seed = 1; seed <= 40 && 확인 < 5; seed += 1) {
      const progress: TeamGameProgress = startTeamGame(
        { mode: 1, ourTeamId: 0, opponentTeamId: 1, playerSide: PLAYER_SIDE_LAST_BAT, opponentAces: { pitcher: -1, batter: -1 } },
        createSeededRandom(seed),
      )
      if (!isTeamPitchTurn(progress)) continue
      const 한번 = 센난수(seed * 11)
      const 붙듦난수 = 센난수(seed * 11)
      const 다돔 = startThrowPitch(progress, { typeNumber: 1, gaugeCell: 0 }, 한번)
      const 붙듦 = startThrowPitch(progress, { typeNumber: 1, gaugeCell: 0 }, 붙듦난수, true)
      if (붙듦.pendingPitchArrival == null) {
        expect(붙듦.lastResolution).toEqual(다돔.lastResolution)
        expect(붙듦난수.drawn()).toBe(한번.drawn())
        continue
      }
      expect(붙듦난수.drawn()).toBeLessThan(한번.drawn())
      expect(startThrowPitch(붙듦, { typeNumber: 1, gaugeCell: 0 }, 붙듦난수, true)).toBe(붙듦)
      const 진입 = enterTeamPitchResult(붙듦, 붙듦난수)
      expect({ ...진입, pendingPitchArrival: undefined }).toEqual({ ...다돔, pendingPitchArrival: undefined })
      expect(붙듦난수.drawn()).toBe(한번.drawn())
      확인 += 1
    }
    expect(확인).toBeGreaterThan(0)
  })
})
