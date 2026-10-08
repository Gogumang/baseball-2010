// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { CONFIRM_LOCK_FRAMES, resultHoldMillisecondsOf, rollDerbySceneStart, SCENE_D_FRAMES, useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'
import { derbyBattedBallOf } from '@/entities/home-run-derby/model/derbyBattedBall'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { createPatternDeck, rollSceneEffectInit } from '@/entities/batting/model/battedBallOutcome'

/** 홈런 결과 코드 하나 — `outcomeOfPattern` 의 마지막 갈래 */
const 홈런코드 = 24

const 홈런: PitchOutcomeDetail = {
  resolution: { kind: '타구', outcome: { kind: '홈런' } },
  hasSwung: true,
  isBunt: false,
  resultCode: 홈런코드,
  // 타석이 실제로 뽑은 패턴 한 장 (원본 표 24 번 묶음)
  pattern: [75, 1451, 1004, 0],
}

const 헛스윙: PitchOutcomeDetail = {
  resolution: { kind: '스트라이크', isSwinging: true },
  hasSwung: true,
  isBunt: false,
  resultCode: null,
}

/** 희생번트 타구 — 번트 판정(0x51226) 성공 코드 6 묶음 (`outcomeOfPattern` 의 case 6) */
const 번트: PitchOutcomeDetail = {
  resolution: { kind: '타구', outcome: { kind: '아웃', detail: '땅볼아웃' } },
  hasSwung: true,
  isBunt: true,
  resultCode: 7,
  pattern: [90, 300, 0, 0],
}

/** 공 하나를 치고 결과 연출이 끝날 때까지 시간을 흘린다 */
function 한구(rendered: { result: { current: ReturnType<typeof useHomeRunDerby> } }, detail: PitchOutcomeDetail) {
  act(() => rendered.result.current.onPitchResolved(detail))
  act(() => {
    vi.advanceTimersByTime(resultHoldMillisecondsOf(detail) + 500)
  })
}

/** 상태 0xe 의 키 잠금(틱 ≤ 2)이 풀리도록 갱신 세 번(62ms × 3)을 흘리고 OK 를 누른다 */
function OK(rendered: { result: { current: ReturnType<typeof useHomeRunDerby> } }) {
  act(() => {
    vi.advanceTimersByTime((SCENE_D_FRAMES + CONFIRM_LOCK_FRAMES) * 62)
  })
  act(() => rendered.result.current.confirm())
}

/** 띄우고 첫 공 앞의 0xe 에서 OK 를 누른다 */
function 띄우기(bestDistance = 0, onFinish?: (result: DerbyResult) => void) {
  const rendered = renderHook(() => useHomeRunDerby({ bestDistance, onFinish }))
  OK(rendered)
  return rendered
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('홈런더비 한 판', () => {
  it('공 하나마다 기회를 쓰고, 볼카운트는 없다', () => {
    const rendered = 띄우기()
    expect(rendered.result.current.run.remainingPitches).toBe(10)
    한구(rendered, 헛스윙)
    expect(rendered.result.current.run.remainingPitches).toBe(9)
  })

  it('홈런이면 비거리가 쌓이고, 아니면 안 쌓인다', () => {
    const rendered = 띄우기()
    한구(rendered, 헛스윙)
    expect(rendered.result.current.run.totalDistance).toBe(0)
    한구(rendered, 홈런)
    expect(rendered.result.current.run.totalDistance).toBeGreaterThan(0)
  })

  it('번트 타구는 따로 다루지 않는다 — 0x17 끝 0xae3e8 의 "홈런 아닌 공" 하나: 기회 −1 · 콤보 끊김 · 페어면 낙구 비거리(0xa600c)', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    한구(rendered, 홈런)
    expect(rendered.result.current.run.combo).toBe(1)
    const 누적 = rendered.result.current.run.totalDistance

    한구(rendered, 번트)

    const run = rendered.result.current.run
    expect(run.remainingPitches).toBe(7)
    expect(run.totalDistance).toBe(누적 + derbyBattedBallOf(번트.pattern!).distance)
    expect(run.combo).toBe(0)
    expect(run.wasPreviousHomeRun).toBe(false)
  })

  it('결과 연출 동안은 멈췄다가 다시 풀린다', () => {
    const rendered = 띄우기()
    act(() => rendered.result.current.onPitchResolved(헛스윙))
    expect(rendered.result.current.isPaused).toBe(true)
    expect(rendered.result.current.banner).not.toBe('')
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(rendered.result.current.isPaused).toBe(false)
    expect(rendered.result.current.banner).toBe('')
  })

  it('10구를 다 쓰면 결과가 나오고 onFinish 가 한 번 불린다 (콤보가 없을 때)', () => {
    const onFinish = vi.fn()
    const rendered = 띄우기(0, onFinish)
    for (let index = 0; index < 10; index += 1) 한구(rendered, 헛스윙)

    expect(rendered.result.current.run.isFinished).toBe(true)
    expect(rendered.result.current.result).not.toBeNull()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(rendered.result.current.result?.pitchCount).toBe(10)
  })

  it('연속 홈런으로 콤보가 생기면 보너스 게임으로 이어진다', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    한구(rendered, 홈런)
    expect(rendered.result.current.run.maxCombo).toBe(1)
    for (let index = 0; index < 8; index += 1) 한구(rendered, 헛스윙)

    expect(rendered.result.current.run.isBonusGame).toBe(true)
    expect(rendered.result.current.run.remainingPitches).toBe(1)
    expect(rendered.result.current.result).toBeNull()
  })

  it('콤보 문구는 표시값 +0x84 를 본다 — 보너스를 여는 마지막 정규 공 홈런도 올린 콤보를 띄운다', () => {
    const rendered = 띄우기()
    for (let index = 0; index < 8; index += 1) 한구(rendered, 헛스윙)
    한구(rendered, 홈런)
    act(() => rendered.result.current.onPitchResolved(홈런))

    expect(rendered.result.current.run.combo).toBe(0)
    expect(rendered.result.current.run.isBonusGame).toBe(true)
    expect(rendered.result.current.banner).toContain('1 COMBO')
    expect(rendered.result.current.shownCombo).toBeNull()
  })

  it('보너스를 열어도 다음 공 준비(0xd → 0xe → OK → 0xf)를 지나 올린 콤보를 21 갱신 띄운다 (U-89 — 0x39e14 · 0x532b0 · 0x50c18 · 0x3dbf8)', () => {
    const rendered = 띄우기()
    for (let index = 0; index < 8; index += 1) 한구(rendered, 헛스윙)
    한구(rendered, 홈런)
    act(() => rendered.result.current.onPitchResolved(홈런))
    expect(rendered.result.current.run.isBonusGame).toBe(true)
    expect(rendered.result.current.shownCombo).toBeNull()
    act(() => {
      vi.advanceTimersByTime(resultHoldMillisecondsOf(홈런) + SCENE_D_FRAMES * 62)
    })
    // 0xd → 0xe: OK 를 기다리는 동안은 아직 0xf 가 아니다
    expect(rendered.result.current.isAwaitingConfirm).toBe(true)
    expect(rendered.result.current.isPaused).toBe(true)
    expect(rendered.result.current.shownCombo).toBeNull()
    OK(rendered)
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    expect(rendered.result.current.shownCombo).toBe(1)
    act(() => {
      vi.advanceTimersByTime(21 * 62)
    })
    expect(rendered.result.current.shownCombo).toBeNull()
    expect(rendered.result.current.run.comboDisplay).toBe(0)
  })

  it('HUD 콤보는 다음 공 준비(상태 0xf)에서 켜져 21 갱신 뒤 꺼지고 +0x84 를 지운다 (0x3dbf8 · 0x45a12)', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    act(() => rendered.result.current.onPitchResolved(홈런))
    // 결과 연출 동안은 아직 안 켜진다
    expect(rendered.result.current.shownCombo).toBeNull()
    act(() => {
      vi.advanceTimersByTime(resultHoldMillisecondsOf(홈런))
    })
    expect(rendered.result.current.shownCombo).toBe(1)
    act(() => {
      vi.advanceTimersByTime(21 * 62)
    })
    expect(rendered.result.current.shownCombo).toBeNull()
    expect(rendered.result.current.run.comboDisplay).toBe(0)
    expect(rendered.result.current.run.combo).toBe(1)
  })

  it('첫 공 앞은 0xd 두 그림 뒤 상태 0xe — OK 를 누를 때까지 멈춰 있고, 들어선 뒤 세 갱신 안의 OK 는 먹지 않는다 (0x3fa50 · 0x39e14 · 0x49a26 · 0x532b0)', () => {
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0 }))
    // 0xd — 아직 OK 를 안 받는다
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    expect(rendered.result.current.isPaused).toBe(true)
    act(() => rendered.result.current.confirm())
    act(() => {
      vi.advanceTimersByTime(SCENE_D_FRAMES * 62 - 1)
    })
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(rendered.result.current.isAwaitingConfirm).toBe(true)
    expect(rendered.result.current.isPaused).toBe(true)
    // 틱 ≤ 2 — 무시
    act(() => rendered.result.current.confirm())
    expect(rendered.result.current.isAwaitingConfirm).toBe(true)
    // 시간 제한·자동 진행이 없다 (0x39bd4 는 모드 7 이면 아무것도 안 한다)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(rendered.result.current.isAwaitingConfirm).toBe(true)
    act(() => rendered.result.current.confirm())
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    expect(rendered.result.current.isPaused).toBe(false)
  })

  it('보통 공 뒤는 0xf 라 OK 를 기다리지 않는다 (0xae3e8 ae4ea)', () => {
    const rendered = 띄우기()
    한구(rendered, 헛스윙)
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    expect(rendered.result.current.isPaused).toBe(false)
  })

  it('단계가 오르면 0xd → 0xe 에서 OK 를 기다린 뒤에야 다음 공(0xf)이다 (0xae3e8 ae4e4)', () => {
    const rendered = 띄우기()
    // 원본 코드 24 [125, 1463, 1234] — 멀리 떨어지는 홈런이라 여덟 개 안에 누적 800 을 넘겨 단계 1
    const 큰홈런: PitchOutcomeDetail = { ...홈런, pattern: [125, 1463, 1234, 0] }
    let 단계 = 0
    for (let index = 0; index < 9 && 단계 === 0; index += 1) {
      한구(rendered, 큰홈런)
      단계 = rendered.result.current.run.stage
      if (단계 === 0) expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    }
    expect(단계).toBe(1)
    expect(rendered.result.current.isAwaitingConfirm).toBe(true)
    expect(rendered.result.current.isPaused).toBe(true)
    // 콤보 표시(0xf 의 0x3dbf8)는 OK 뒤에 켜진다
    expect(rendered.result.current.shownCombo).toBeNull()
    act(() => rendered.result.current.confirm())
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    expect(rendered.result.current.shownCombo).toBe(rendered.result.current.run.comboDisplay)
  })

  it('다시하기는 판을 처음으로 되돌린다', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    act(() => rendered.result.current.restart())

    expect(rendered.result.current.run.remainingPitches).toBe(10)
    expect(rendered.result.current.run.totalDistance).toBe(0)
    expect(rendered.result.current.result).toBeNull()
    // 새 장면도 첫 공 앞 0xd 를 지나 0xe 에서 OK 를 기다린다
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    expect(rendered.result.current.isPaused).toBe(true)
    act(() => {
      vi.advanceTimersByTime(SCENE_D_FRAMES * 62)
    })
    expect(rendered.result.current.isAwaitingConfirm).toBe(true)
  })

  it('이벤트 존은 친 공의 패턴 플래그 & 2 로만 정해진다 (플레이 +0x127, 0xb07c8)', () => {
    const rendered = 띄우기()
    act(() => rendered.result.current.onPitchResolved({ ...홈런, pattern: [118, 961, 1367, 2] }))
    expect(rendered.result.current.isEventZoneShown).toBe(true)
    expect(rendered.result.current.run.bonusGamePoint).toBe(200)
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    // 플래그 0 패턴(같은 홈런)은 존이 없다
    act(() => rendered.result.current.onPitchResolved(홈런))
    expect(rendered.result.current.isEventZoneShown).toBe(false)
  })

  it('단계가 오르면 마투수가 등판한다', () => {
    const rendered = 띄우기()
    expect(rendered.result.current.pitcher.ace).toBeNull()
    // 단계 0 은 구질 1 만 던진다
    expect(rendered.result.current.pitcher.pitchType).toBe(1)
  })
})

describe('경기 시작 굴림 — 0x39fdc 모드 7 갈래 3a454 rand(0, 9) 뒤 0xc0dac 의 rand(0, 2) (0x3f584 공통 꼬리)', () => {
  function 기록난수() {
    const calls: [number, number][] = []
    const random = {
      next: () => 0,
      nextInRange: (min: number, max: number) => {
        calls.push([min, max])
        return min
      },
      pick: <T,>(items: readonly T[]) => items[0],
    }
    return { random, calls }
  }

  it('들어서면 한 번 — 다시 그려도 더 굴리지 않는다', () => {
    const { random, calls } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    expect(calls).toEqual([[0, 9], [0, 2]])
    rendered.rerender()
    expect(calls).toEqual([[0, 9], [0, 2]])
  })

  it('다시하기도 새 장면이라 같은 둘을 또 굴린다', () => {
    const { random, calls } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    act(() => rendered.result.current.restart())
    expect(calls).toEqual([[0, 9], [0, 2], [0, 9], [0, 2]])
  })

  it('결과 창 [예]는 단계 0 이면 다시하기와 같다 (0x40a5e 단계 ≤ 0 → 0x40a98)', () => {
    const { random, calls } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    act(() => rendered.result.current.retryFromResult())
    expect(calls).toEqual([[0, 9], [0, 2], [0, 9], [0, 2]])
  })

  it('결과 창 [예]는 단계 > 0 이면 rand(1, 4) 를 먼저 하나 굴린다 (0x40a7e)', () => {
    const { random, calls } = 기록난수()
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    OK(rendered)
    const 큰홈런: PitchOutcomeDetail = { ...홈런, pattern: [45, 2000, 1500, 0] }
    for (let index = 0; index < 9 && rendered.result.current.run.stage === 0; index += 1) 한구(rendered, 큰홈런)
    expect(rendered.result.current.run.stage).toBe(1)
    calls.length = 0
    act(() => rendered.result.current.retryFromResult())
    expect(calls).toEqual([[1, 4], [0, 9], [0, 2]])
  })
})

describe('더비 판의 HOMERUN 글자 · 비거리 판 · 홈런 뒤 키 건너뛰기', () => {
  /** `performance.now()` 를 손으로 모는 시계 — 판 틱(공 틱 0 = onPitchResolved)을 정확히 맞춘다 */
  function 시계() {
    let now = 1000
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => now)
    return {
      get now() {
        return now
      },
      흘리기(ms: number) {
        now += ms
        act(() => {
          vi.advanceTimersByTime(ms)
        })
      },
      spy,
    }
  }

  it('홈런이면 홈런 틱에 글자 창을 켜고 관문이 닫히는 틱에 끝낸다 — 비거리 판은 판 내내, 판 끝에 둘 다 끈다', () => {
    const 째깍 = 시계()
    const rendered = 띄우기()
    const 판 = derbyBattedBallOf(홈런.pattern!)
    const 시작 = 째깍.now
    act(() => rendered.result.current.onPitchResolved(홈런))
    const ms = millisecondsPerFrame()
    expect(rendered.result.current.homeRunText?.startedAt).toBe(시작 + 판.homeRunTicks[0]! * ms)
    expect(rendered.result.current.homeRunText?.endsAt).toBe(시작 + 판.closeTick * ms)
    expect(rendered.result.current.distanceBoard?.startedAt).toBe(시작)
    expect(rendered.result.current.distanceBoard?.previous).toBe(0)
    째깍.흘리기(판.endTicks * ms + 1)
    expect(rendered.result.current.homeRunText).toBeNull()
    expect(rendered.result.current.distanceBoard).toBeNull()
    째깍.spy.mockRestore()
  })

  it('홈런 아닌 맞은 공도 비거리 판은 뜨고 글자는 없다', () => {
    const rendered = 띄우기()
    act(() => rendered.result.current.onPitchResolved(번트))
    expect(rendered.result.current.homeRunText).toBeNull()
    expect(rendered.result.current.distanceBoard).not.toBeNull()
  })

  it('홈런 아닌 맞은 공은 키를 눌러도 판 길이 그대로다', () => {
    const 째깍 = 시계()
    const rendered = 띄우기()
    act(() => rendered.result.current.onPitchResolved(번트))
    째깍.흘리기(3 * millisecondsPerFrame())
    act(() => rendered.result.current.skipHomeRun())
    expect(rendered.result.current.distanceBoard?.batted.skippedAtTick).toBeNull()
    째깍.spy.mockRestore()
  })

  it('홈런 틱 뒤의 키는 판을 키 틱 + 1 + 10 에 끝내고 글자를 그 틱부터 끈다 (0x519cc · 5284e)', () => {
    const 째깍 = 시계()
    const rendered = 띄우기()
    const 판 = derbyBattedBallOf(홈런.pattern!)
    const 홈런틱 = 판.homeRunTicks[0]!
    const ms = millisecondsPerFrame()
    const 시작 = 째깍.now
    act(() => rendered.result.current.onPitchResolved(홈런))
    // 틱 홈런틱 의 그림이 지난 뒤 — 다음 틱(홈런틱 + 1)이 키를 받는다
    째깍.흘리기(홈런틱 * ms + 1)
    act(() => rendered.result.current.skipHomeRun())
    const 키틱 = 홈런틱 + 1
    expect(rendered.result.current.distanceBoard?.batted.skippedAtTick).toBe(키틱)
    expect(rendered.result.current.homeRunText?.endsAt).toBe(시작 + 키틱 * ms)
    // 판 끝 = 키 틱 + 1(관문) + 10
    째깍.흘리기((키틱 + 1 + 10) * ms - (째깍.now - 시작) - 1)
    expect(rendered.result.current.isPaused).toBe(true)
    째깍.흘리기(2)
    expect(rendered.result.current.distanceBoard).toBeNull()
    expect(rendered.result.current.run.remainingPitches).toBe(9)
    째깍.spy.mockRestore()
  })
})

describe('홈런더비 경기 장면 로딩 판 (상태 7 진입 0x39f88 → 7 · 9 · 8 적재)', () => {
  it('장면을 세우면 로딩 판이 서고, 다 그린 뒤에야 0xd 두 그림 → 0xe 로 온다', () => {
    const random = createSeededRandom(5)
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    expect(rendered.result.current.loadingTip).toBe(LOADING_TIPS[rollSceneLoadingTip(createSeededRandom(5))])
    expect(rendered.result.current.isPaused).toBe(true)
    // 로딩 판이 서 있는 동안은 0xd 시계가 안 돈다
    act(() => {
      vi.advanceTimersByTime((SCENE_D_FRAMES + CONFIRM_LOCK_FRAMES) * 62 * 4)
    })
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
    act(() => rendered.result.current.finishLoading())
    expect(rendered.result.current.loadingTip).toBeNull()
    act(() => {
      vi.advanceTimersByTime(SCENE_D_FRAMES * millisecondsPerFrame() + 1)
    })
    expect(rendered.result.current.isAwaitingConfirm).toBe(true)
  })

  it('다시하기도 새 장면이라 로딩 판이 다시 선다 — 다음 rand(0, 73) 칸', () => {
    const random = createSeededRandom(5)
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random }))
    act(() => rendered.result.current.finishLoading())
    act(() => rendered.result.current.restart())
    const expected = createSeededRandom(5)
    rollDerbySceneStart(expected)
    expect(rendered.result.current.loadingTip).toBe(LOADING_TIPS[rollSceneLoadingTip(expected)])
    expect(rendered.result.current.isAwaitingConfirm).toBe(false)
  })

  it('난수가 없으면(예전 시험) 로딩 판 없이 곧장 0xd', () => {
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0 }))
    expect(rendered.result.current.loadingTip).toBeNull()
  })
})

describe('홈런더비 장면 시작 굴림 차례 (`rollDerbySceneStart`)', () => {
  it('상태 7 진입 팁 rand(0, 73) → 덱 1275 → 효과 1202 → 상태 9 rand(0, 9) → rand(0, 2) → 상태 8 하늘 줄 rand(0, 6)', () => {
    const random = createSeededRandom(21)
    const expected = createSeededRandom(21)
    const { loadingTipIndex, skyRow } = rollDerbySceneStart(random)
    expect(loadingTipIndex).toBe(rollSceneLoadingTip(expected))
    createPatternDeck(expected)
    rollSceneEffectInit(expected)
    randomIntegerBelow(expected, 0, 9)
    randomIntegerBelow(expected, 0, 2)
    expect(skyRow).toBe(randomIntegerBelow(expected, 0, 6))
    expect(random.next()).toBe(expected.next())
  })
})
