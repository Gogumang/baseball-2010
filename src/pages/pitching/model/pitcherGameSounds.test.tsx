// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { usePitcherGame } from '@/pages/pitching/model/usePitcherGame'
import type { PitcherGameOptions } from '@/pages/pitching/model/usePitcherGame'
import { GAME_INTRO_SOUND } from '@/features/play-game/model/gameSounds'
import { PITCH_RELEASE_SOUND } from '@/features/play-at-bat/model/atBatSounds'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'

/** 무엇이 몇 번 울렸는지 적어 두는 포트 */
function 녹음포트() {
  const played: number[] = []
  const port: SoundPort = {
    play: (id) => {
      played.push(id)
    },
    playBgm: () => {},
    stopBgm: () => {},
    resumeBgm: () => {},
    currentBgm: () => null,
    setVolume: () => {},
    getVolume: () => 100,
  }
  return { played, port }
}

const 기본옵션: PitcherGameOptions = {
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  role: PITCHER_ROLE.starter,
  positionCode: 0,
  // 짝수 날이라 내 선발이 등판한다 (0xa4f60 표)
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

let 녹음 = 녹음포트()
beforeEach(() => {
  녹음 = 녹음포트()
  setActiveSound(녹음.port)
})
afterEach(() => setActiveSound(null))

const 띄우기 = (seed = 20100901) =>
  renderHook(() => usePitcherGame(기본옵션, createSeededRandom(seed)))

describe('투수편 화면의 소리 배선', () => {
  it('경기가 서면 인트로 예약음 61 이 난다 (상태 0xc 진입 0x3b148)', () => {
    띄우기()
    expect(녹음.played[0]).toBe(GAME_INTRO_SOUND)
  })

  it('한 개 던지면 투구 순간 소리 12 가 먼저, 이어서 심판 콜이 난다 (0x3f378 → 0x51a94)', () => {
    const { result } = 띄우기()
    expect(result.current.canPitch).toBe(true)
    녹음.played.length = 0

    act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: 4, gaugeCell: 0 }))
    expect(녹음.played[0]).toBe(PITCH_RELEASE_SOUND)

    // 심판 콜은 난수가 정한다 — 몇 개 더 던져 볼·스트라이크 계열이 통로까지 가는지 본다
    // (16 "Ball!" · 18 "Strike!" · 39 "Strike two!" · 21 삼진 · 24 볼넷 · 25 파울)
    for (let pitch = 0; pitch < 12; pitch += 1) {
      if (result.current.progress.pendingDefensePlay !== null) {
        act(() => result.current.actions.finishDefensePlay())
        continue
      }
      if (!result.current.canPitch) break
      act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: 4, gaugeCell: 0 }))
    }
    expect(녹음.played.some((id) => [16, 18, 39, 21, 24, 25].includes(id))).toBe(true)
  })
})
