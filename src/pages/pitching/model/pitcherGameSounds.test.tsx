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
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
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

  /**
   * 세이프 17 · 함성 60 은 **수비 결과를 넘겨야** 열리는 갈래다 — 한동안 타자편
   * (`useCareerSession`)만 넘겨 주어 투수편에서는 둘 다 안 났다.
   */
  it('안타인데 그 루로 송구가 도착했으면 세이프 17 이 난다 (0x51c14)', () => {
    // 씨앗 1 은 첫 인플레이 타구가 **안타**다 (기본 씨앗은 그 앞에 감독 강판이 와 더 못 던진다)
    const { result } = 띄우기(1)

    // 인플레이 **안타**가 나올 때까지 던진다 — 무엇이 나올지는 난수가 정한다.
    // 아웃이 걸린 타구는 그대로 흘려보내고, 중간에 뜨는 창(감독 대사·돌발)은 닫아 가며 이어 던진다
    for (let pitch = 0; pitch < 400; pitch += 1) {
      const 진행 = result.current.progress
      if (진행.pendingDefensePlay !== null) {
        if (진행.pendingDefensePlay.outcome.kind === '안타') break
        act(() => result.current.actions.finishDefensePlay())
        continue
      }
      if (진행.managerHookText !== null) {
        act(() => result.current.actions.confirmManagerHook())
        continue
      }
      if (진행.burst !== null && 진행.burst.current !== null) {
        act(() => result.current.actions.closeBurst())
        continue
      }
      if (!result.current.canPitch) break
      act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: 4, gaugeCell: 0 }))
    }
    const pending = result.current.progress.pendingDefensePlay
    expect(pending?.outcome.kind).toBe('안타')

    // 송구 칸만 원본 세이프 조건("아웃 될 뻔했는데 살았다")에 맞춰 둔다 — 나머지는 진행기 그대로다
    const 결과 = { ...runDefensePlay(pending!), throwBase: 2, throwArrivalTick: 10 }
    녹음.played.length = 0

    act(() => result.current.actions.finishDefensePlay(결과))
    expect(녹음.played).toContain(17)
  })
})
