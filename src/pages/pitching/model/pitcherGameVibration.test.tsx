// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { usePitcherGame } from '@/pages/pitching/model/usePitcherGame'
import type { PitcherGameOptions } from '@/pages/pitching/model/usePitcherGame'
import { pitchSlotsFor } from '@/features/play-pitcher-game/model/pitcherGameFlow'

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

const 진동 = vi.fn<(pattern: VibratePattern) => boolean>(() => true)
const 원래진동 = Object.getOwnPropertyDescriptor(navigator, 'vibrate')
beforeEach(() => {
  진동.mockClear()
  Object.defineProperty(navigator, 'vibrate', { value: 진동, configurable: true, writable: true })
})
afterEach(() => {
  if (원래진동 === undefined) delete (navigator as { vibrate?: unknown }).vibrate
  else Object.defineProperty(navigator, 'vibrate', 원래진동)
})

/** 공을 던져 가며 공마다 (그 전 스트라이크, 판정 종류, 울린 진동) 을 모은다 */
function 던지며모으기(isVibrationOn: boolean | undefined, seed: number) {
  const { result } = renderHook(() => usePitcherGame(기본옵션, createSeededRandom(seed), isVibrationOn))
  // 마구를 뺀 구질을 돌려 가며 아홉 코스에 던진다
  const 구질 = pitchSlotsFor(result.current.progress).map((slot) => slot.typeNumber).filter((type) => type !== 22)
  const 기록: { strikesBefore: number; kind: string | undefined; calls: unknown[] }[] = []
  for (let step = 0; step < 300; step += 1) {
    if (result.current.progress.pendingDefensePlay !== null) {
      act(() => result.current.actions.finishDefensePlay())
      continue
    }
    if (!result.current.canPitch) break
    const strikesBefore = result.current.progress.atBat.strikes
    진동.mockClear()
    act(() => result.current.actions.throwPitch({ typeNumber: 구질[step % 구질.length] ?? 1, courseCell: step % 9, gaugeCell: 0 }))
    기록.push({
      strikesBefore,
      kind: result.current.progress.lastResolution?.kind,
      calls: 진동.mock.calls.map((call) => call[0]),
    })
  }
  return 기록
}

describe('투수편 — 내가 잡은 삼진도 100ms 울린다 (상태 0x12 그리기 0x4ce9c 의 0x4d0d6)', () => {
  it('세 번째 스트라이크에서만 100ms, 그 밖의 공은 울리지 않는다', () => {
    const 기록 = 던지며모으기(true, 4)
    const 삼진 = 기록.filter((공) => 공.kind === '스트라이크' && 공.strikesBefore >= 2)
    expect(삼진.length).toBeGreaterThan(0)
    for (const 공 of 기록) {
      const 삼진공 = 공.kind === '스트라이크' && 공.strikesBefore >= 2
      expect(공.calls).toEqual(삼진공 ? [100] : [])
    }
  })

  it('환경설정 진동이 꺼졌으면 삼진에도 울리지 않는다 (0x3a44 가 +0x3b 를 본다)', () => {
    const 기록 = 던지며모으기(false, 4)
    expect(기록.some((공) => 공.kind === '스트라이크' && 공.strikesBefore >= 2)).toBe(true)
    expect(기록.every((공) => 공.calls.length === 0)).toBe(true)
  })
})
