// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  CONFIRM_LOCK_FRAMES,
  SCENE_D_FRAMES,
  resultHoldMillisecondsOf,
  rollDerbySceneStart,
  useHomeRunDerby,
} from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { derbyBattedBallOf } from '@/entities/home-run-derby/model/derbyBattedBall'
import { DERBY_NO_BATTER_SAVE_TEAM_ID } from '@/entities/home-run-derby/model/derbyRules'

/** 무엇이 울렸는지 적어 두는 포트 */
function 녹음포트() {
  const played: number[] = []
  const port: SoundPort = {
    play: (id) => {
      played.push(id)
    },
    playBgm: () => {},
    stopBgm: () => {},
    resumeBgm: () => {},
    stop: () => {},
    currentBgm: () => null,
    setVolume: () => {},
    getVolume: () => 100,
  }
  return { played, port }
}

/** 굴림을 적고 정해 둔 값을 돌려주는 가짜 — `value(lo, hi)` 가 없으면 lo */
function 기록난수(value: (lo: number, hi: number) => number = (lo, hi) => Math.min(lo, hi)) {
  const calls: [number, number][] = []
  const random: RandomPort = {
    rand: (lo, hi) => {
      calls.push([lo, hi])
      return value(lo, hi)
    },
    rand9d: () => 0,
  }
  return { random, calls }
}

const 홈런: PitchOutcomeDetail = {
  resolution: { kind: '타구', outcome: { kind: '홈런' } },
  hasSwung: true,
  isBunt: false,
  resultCode: 24,
  pattern: [75, 1451, 1004, 0],
  contactSoundId: 5,
}
const 볼: PitchOutcomeDetail = { resolution: { kind: '볼' }, hasSwung: false, isBunt: false, resultCode: null, contactSoundId: null }
const 사구: PitchOutcomeDetail = { resolution: { kind: '사구' }, hasSwung: false, isBunt: false, resultCode: null, contactSoundId: null }
const 헛스윙: PitchOutcomeDetail = {
  resolution: { kind: '스트라이크', isSwinging: true },
  hasSwung: true,
  isBunt: false,
  resultCode: null,
  contactSoundId: 8,
}

type Rendered = { result: { current: ReturnType<typeof useHomeRunDerby> } }

function 한구(rendered: Rendered, detail: PitchOutcomeDetail) {
  act(() => rendered.result.current.onPitchResolved(detail))
  act(() => {
    vi.advanceTimersByTime(resultHoldMillisecondsOf(detail, 3) + 1)
  })
}

function OK(rendered: Rendered) {
  act(() => {
    vi.advanceTimersByTime((SCENE_D_FRAMES + CONFIRM_LOCK_FRAMES) * millisecondsPerFrame())
  })
  act(() => rendered.result.current.confirm())
}

let 녹음 = 녹음포트()
beforeEach(() => {
  vi.useFakeTimers()
  녹음 = 녹음포트()
  setActiveSound(녹음.port)
})
afterEach(() => {
  vi.useRealTimers()
  setActiveSound(null)
})

describe('단계 0 상대 투수 — 0x39fdc 모드 7 갈래 3a454 의 상대 팀 v · 투수 줄 2', () => {
  it('rand(0, 9) 가 내 팀이면 9 로 바꾼다 (3a45a)', () => {
    expect(rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 4 : lo)).random, 4).opponentTeamId).toBe(9)
    expect(rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 4 : lo)).random, 3).opponentTeamId).toBe(4)
    expect(rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 4 : lo)).random).opponentTeamId).toBe(4)
  })

  it('나리 타자편 저장이 없으면 r7 = 0 이라 0 이 나오면 9 다 (0x213c0 이 0 으로 세운 버퍼 · 0x20ac4 는 파일이 없으면 안 쓴다)', () => {
    expect(DERBY_NO_BATTER_SAVE_TEAM_ID).toBe(0)
    expect(rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 0 : lo)).random).opponentTeamId).toBe(9)
    expect(
      rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 0 : lo)).random, DERBY_NO_BATTER_SAVE_TEAM_ID).opponentTeamId,
    ).toBe(9)
    expect(rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 0 : lo)).random, 3).opponentTeamId).toBe(0)
  })

  it('단계 0 투수는 그 팀의 투수 줄 2 다', () => {
    const v = rollDerbySceneStart(createSeededRandom(7), 2).opponentTeamId
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random: createSeededRandom(7), myTeamId: 2 }))
    expect(rendered.result.current.pitcher.ace).toBeNull()
    expect(rendered.result.current.pitcher.name).toBe(teamPitchers(v)[2]!.name)
  })
})

describe('심판 콜 — 판정 스위치 0x3dfac · 화면 0x51a56 은 모드를 안 가린다', () => {
  it('헛스윙은 타구음 8 뒤 18, 볼은 셋째까지 16 · 넷째부터 24, 사구는 23', () => {
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0 }))
    OK(rendered)
    한구(rendered, 헛스윙)
    expect(녹음.played).toEqual([8, 18])
    녹음.played.length = 0
    for (let index = 0; index < 5; index += 1) 한구(rendered, 볼)
    expect(녹음.played).toEqual([16, 16, 16, 24, 24])
    녹음.played.length = 0
    한구(rendered, 사구)
    expect(녹음.played).toEqual([23])
  })

  it('볼 수는 상태 0xd 진입(0x48e9c)에서만 지운다 — 보너스를 연 0xd 뒤 볼은 다시 16', () => {
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0 }))
    OK(rendered)
    한구(rendered, 홈런)
    한구(rendered, 홈런)
    for (let index = 0; index < 8; index += 1) 한구(rendered, 볼)
    expect(rendered.result.current.run.isBonusGame).toBe(true)
    OK(rendered)
    녹음.played.length = 0
    한구(rendered, 볼)
    // 보너스 한 구가 마지막 공이라 결과 소리가 뒤따른다
    expect(녹음.played[0]).toBe(16)
  })
})

describe('맞지 않은 공의 대기 — 상태 0x12 0x4e6de~0x4e730', () => {
  it('헛스윙 · 볼은 15틱, 사구는 31틱 뒤에 다음으로 간다', () => {
    const ms = millisecondsPerFrame()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0 }))
    OK(rendered)
    act(() => rendered.result.current.onPitchResolved(헛스윙))
    act(() => {
      vi.advanceTimersByTime(15 * ms - 1)
    })
    expect(rendered.result.current.isPaused).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(rendered.result.current.isPaused).toBe(false)

    act(() => rendered.result.current.onPitchResolved(사구))
    act(() => {
      vi.advanceTimersByTime(31 * ms - 1)
    })
    expect(rendered.result.current.isPaused).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(rendered.result.current.isPaused).toBe(false)
    expect(rendered.result.current.run.remainingPitches).toBe(8)
  })
})

describe('사구 뒤 벤치 클리어링 — 0x4e740 의 종류 8 검사는 사구(v4 가 종류 2)에서 늘 거짓', () => {
  it('rand(0, 99) ≤ 19 면 0x1e — 진입 굴림 45 번, 틱 10 이 돌았으면 8 번 더, 끝나면 0xae24c', () => {
    const { random, calls } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    act(() => rendered.result.current.finishLoading())
    OK(rendered)
    calls.length = 0
    act(() => rendered.result.current.onPitchResolved(사구))
    act(() => {
      vi.advanceTimersByTime(31 * millisecondsPerFrame())
    })
    expect(calls[0]).toEqual([0, 99])
    expect(calls).toHaveLength(1 + 45)
    expect(rendered.result.current.isBenchClearing).toBe(true)
    act(() => rendered.result.current.finishBenchClearing(true))
    expect(calls).toHaveLength(1 + 45 + 8)
    expect(rendered.result.current.isBenchClearing).toBe(false)
    expect(rendered.result.current.run.remainingPitches).toBe(9)
    expect(rendered.result.current.isPaused).toBe(false)
  })

  it('rand(0, 99) > 19 면 굴림 하나만 쓰고 보통 길', () => {
    const { random, calls } = 기록난수((lo, hi) => (lo === 0 && hi === 99 ? 20 : Math.min(lo, hi)))
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    act(() => rendered.result.current.finishLoading())
    OK(rendered)
    calls.length = 0
    한구(rendered, 사구)
    expect(calls).toEqual([[0, 99]])
    expect(rendered.result.current.isBenchClearing).toBe(false)
    expect(rendered.result.current.run.remainingPitches).toBe(9)
  })

  it('볼넷(v3)은 st[0xb] = 3 이라 굴리지 않는다 (0x4e748)', () => {
    const { random, calls } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    act(() => rendered.result.current.finishLoading())
    OK(rendered)
    calls.length = 0
    for (let index = 0; index < 5; index += 1) 한구(rendered, 볼)
    expect(calls).toEqual([])
  })
})

describe('화면 갱신 때 — 셈은 판 끝 0xae3e8 · 마투수는 0xd 진입 0x48d50', () => {
  it('맞은 공의 판 동안 기회 · 누적 칸은 그대로고 판 끝에 바뀐다', () => {
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0 }))
    OK(rendered)
    act(() => rendered.result.current.onPitchResolved(홈런))
    expect(rendered.result.current.run.remainingPitches).toBe(10)
    expect(rendered.result.current.run.totalDistance).toBe(0)
    act(() => {
      vi.advanceTimersByTime(derbyBattedBallOf(홈런.pattern!).endTicks * millisecondsPerFrame())
    })
    expect(rendered.result.current.run.remainingPitches).toBe(9)
    expect(rendered.result.current.run.totalDistance).toBeGreaterThan(0)
  })

  it('사구 뒤 벤치 클리어링 동안도 기회 칸은 그대로 — 출구 0xae24c 에서 센다', () => {
    const { random } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    act(() => rendered.result.current.finishLoading())
    OK(rendered)
    act(() => rendered.result.current.onPitchResolved(사구))
    act(() => {
      vi.advanceTimersByTime(31 * millisecondsPerFrame())
    })
    expect(rendered.result.current.isBenchClearing).toBe(true)
    expect(rendered.result.current.run.remainingPitches).toBe(10)
    act(() => rendered.result.current.finishBenchClearing(false))
    expect(rendered.result.current.run.remainingPitches).toBe(9)
  })

  it('단계를 올린 공의 판 동안은 앞 투수 그대로 — 판 끝 0xd 에서 마투수가 선다', () => {
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0 }))
    OK(rendered)
    const 큰홈런: PitchOutcomeDetail = { ...홈런, pattern: [125, 1463, 1234, 0] }
    for (let index = 0; index < 9 && rendered.result.current.run.stage === 0; index += 1) {
      act(() => rendered.result.current.onPitchResolved(큰홈런))
      expect(rendered.result.current.pitcher.ace).toBeNull()
      act(() => {
        vi.advanceTimersByTime(resultHoldMillisecondsOf(큰홈런) + 1)
      })
    }
    expect(rendered.result.current.run.stage).toBe(1)
    expect(rendered.result.current.pitcher.ace?.name).toBe('레오니')
  })
})
