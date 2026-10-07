// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
import type { TeamGameOptions } from '@/pages/team-game/model/useTeamGame'
import { pitchSlotsFor } from '@/features/play-team-game/model/teamGameFlow'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
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

/** 수비 반 이닝에 공을 던져 가며 공마다 (그 전 스트라이크, 판정 종류, 울린 진동) 을 모은다 */
function 던지며모으기(isVibrationOn: boolean | undefined, seed: number) {
  const random = createSeededRandom(seed)
  const { result } = renderHook(() => useTeamGame(기본옵션, random, isVibrationOn))
  const 기록: { strikesBefore: number; kind: string | undefined; calls: unknown[] }[] = []
  for (let step = 0; step < 400; step += 1) {
    if (result.current.pendingDefensePlay !== null) {
      act(() => result.current.actions.finishDefensePlay())
      continue
    }
    // 0xe 의 OK — 화면은 OK 전에 공을 안 낸다
    if (result.current.progress.sceneConfirmPending === true) {
      act(() => result.current.actions.confirmScene())
      continue
    }
    if (result.current.canBat) {
      // 우리 공격 반쪽의 삼진은 타석 화면(`BattingStage`)이 울린다 — 이 고리는 울리지 않는다
      진동.mockClear()
      act(() => result.current.actions.applyOutcome({ kind: '삼진' }))
      expect(진동).not.toHaveBeenCalled()
      continue
    }
    if (!result.current.canPitch) break
    const { progress } = result.current
    const 구질 = pitchSlotsFor(progress).map((slot) => slot.typeNumber).filter((type) => type !== 22)
    const strikesBefore = progress.atBat.strikes
    진동.mockClear()
    act(() =>
      result.current.actions.throwPitch({ typeNumber: 구질[step % 구질.length] ?? 1, courseCell: step % 9, gaugeCell: 0 }),
    )
    기록.push({
      strikesBefore,
      kind: result.current.progress.lastResolution?.kind,
      calls: 진동.mock.calls.map((call) => call[0]),
    })
  }
  return 기록
}

const 삼진공 = (공: { strikesBefore: number; kind: string | undefined }) => 공.kind === '스트라이크' && 공.strikesBefore >= 2

describe('팀경기 수비 — 내가 던져 잡은 삼진도 100ms 울린다 (상태 0x12 그리기 0x4ce9c 의 0x4d0d6)', () => {
  it('세 번째 스트라이크에서만 100ms, 그 밖의 공은 울리지 않는다', () => {
    const 기록 = 던지며모으기(true, 1)
    expect(기록.some(삼진공)).toBe(true)
    for (const 공 of 기록) expect(공.calls).toEqual(삼진공(공) ? [100] : [])
  })

  it('환경설정 진동이 꺼졌으면 울리지 않는다', () => {
    const 기록 = 던지며모으기(false, 1)
    expect(기록.some(삼진공)).toBe(true)
    expect(기록.every((공) => 공.calls.length === 0)).toBe(true)
  })
})
