// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMissionSession } from '@/app/model/useMissionSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { modePitcherOf } from '@/app/model/modePitcher'
import { aceMatchMissionOf } from '@/entities/story/model/aceMatch'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import { MISSIONS } from '@/shared/config/original/missions'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'

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

interface 공기록 {
  readonly strikesBefore: number
  readonly kind: PitchResolution['kind'] | undefined
  readonly calls: unknown[]
}

/** 난수 굴림 수를 세는 씨앗 난수 */
function 센난수(seed: number) {
  const inner = createSeededRandom(seed)
  let draws = 0
  const port: RandomPort = {
    rand: (lo: number, hi: number) => {
      draws += 1
      return inner.rand(lo, hi)
    },
    rand9d: (n: number) => {
      if (n > 0) draws += 1
      return inner.rand9d(n)
    },
  }
  return { port, drawn: () => draws }
}

/**
 * 투수 미션을 던져 가며 공마다 (그 전 스트라이크, 판정 종류, 울린 진동) 을 모은다.
 * 판정은 러너의 `applyPitch` 를 엿봐서 얻는다 — 세션이 공마다 꼭 한 번 부른다.
 */
function 던지며모으기(isVibrationOn: boolean | undefined, seed: number, aceMatch = false) {
  const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
  const screen: Screen = aceMatch ? { kind: '투수편' } : { kind: '미션선택' }
  const random = 센난수(seed)
  const pitcher = modePitcherOf(createPitcherCareer('진동투수'))
  let 판정: { strikesBefore: number; kind: PitchResolution['kind'] } | null = null
  const rendered = renderHook(() => {
    const base = useAtBatRunner()
    const runner = {
      ...base,
      applyPitch: (resolution: PitchResolution) => {
        판정 = { strikesBefore: base.atBatRef.current.strikes, kind: resolution.kind }
        return base.applyPitch(resolution)
      },
    }
    return useMissionSession({
      runner,
      random: random.port,
      missionRecord,
      screen,
      setScreen: vi.fn(),
      pitcher,
      ...(isVibrationOn === undefined ? {} : { isVibrationOn }),
    })
  })
  const mission = aceMatch ? aceMatchMissionOf(16, '투수') : MISSIONS.find((row) => row.side === '투수' && row.id === 1)
  if (mission === null || mission === undefined) throw new Error('투수 미션이 없다')
  const begin = () =>
    act(() =>
      aceMatch
        ? rendered.result.current.actions.beginPitcherAceMatch(mission)
        : rendered.result.current.actions.begin(mission),
    )
  begin()
  const 기록: 공기록[] = []
  for (let step = 0; step < 200; step += 1) {
    const session = rendered.result.current
    if (session.pendingDefensePlay !== null) {
      act(() => session.actions.finishDefensePlay())
      continue
    }
    if (session.pendingBenchClearing !== null) {
      act(() => session.actions.finishBenchClearing(false))
      continue
    }
    if (session.pitcherRun?.status !== '진행중') {
      begin()
      continue
    }
    판정 = null
    진동.mockClear()
    // 코스를 돌려 가며 게이지 없이 직구 — 스트라이크·볼이 섞이게
    act(() => session.handleThrow(PITCH_TYPES[0], step % 9, 0, false))
    const thrown = 판정 as { strikesBefore: number; kind: PitchResolution['kind'] } | null
    기록.push({
      strikesBefore: thrown?.strikesBefore ?? -1,
      kind: thrown?.kind,
      calls: 진동.mock.calls.map((call) => call[0]),
    })
  }
  rendered.unmount()
  return { 기록, drawn: random.drawn() }
}

const 삼진공 = (공: 공기록) => 공.kind === '스트라이크' && 공.strikesBefore >= 2

describe('투수 미션(모드 5) — 내가 잡은 삼진도 100ms 울린다 (상태 0x12 그리기 0x4ce9c 의 0x4d0d6)', () => {
  it('세 번째 스트라이크에서만 100ms, 그 밖의 공은 울리지 않는다 (안 넘기면 켬)', () => {
    const { 기록 } = 던지며모으기(undefined, 3)
    expect(기록.filter(삼진공).length).toBeGreaterThan(0)
    for (const 공 of 기록) expect(공.calls).toEqual(삼진공(공) ? [100] : [])
  })

  it('환경설정 진동이 꺼졌으면 삼진에도 울리지 않는다 (0x3a44 가 +0x3b 를 본다)', () => {
    const { 기록 } = 던지며모으기(false, 3)
    expect(기록.some(삼진공)).toBe(true)
    expect(기록.every((공) => 공.calls.length === 0)).toBe(true)
  })

  it('진동은 난수를 안 쓴다 — 켬·끔의 판정과 굴림 수가 같다', () => {
    const 켬 = 던지며모으기(true, 7)
    const 끔 = 던지며모으기(false, 7)
    expect(켬.drawn).toBe(끔.drawn)
    expect(켬.기록.map(({ strikesBefore, kind }) => [strikesBefore, kind])).toEqual(
      끔.기록.map(({ strikesBefore, kind }) => [strikesBefore, kind]),
    )
  })
})

describe('투수편 마선수 대결도 투수 미션(모드 5) 투구 길이다 — 같은 0x12 를 지난다', () => {
  it('세 번째 스트라이크에서만 100ms', () => {
    const 모음: 공기록[] = []
    for (let seed = 1; seed <= 6 && !모음.some(삼진공); seed += 1) 모음.push(...던지며모으기(true, seed, true).기록)
    expect(모음.some(삼진공)).toBe(true)
    for (const 공 of 모음) expect(공.calls).toEqual(삼진공(공) ? [100] : [])
  })
})
