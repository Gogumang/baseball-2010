// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { BaseState } from '@/entities/game/model/baseState'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { openPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **수비 · 주루 키는 누를 때 화면에 있던 그림의 틱으로 받는다** (r217 — r211 타석 키와 같은 웹판 전용 지연).
 *
 * 원본은 키를 받은 틀 = 마지막으로 그린 틀이고, 다음 틀의 키 처리 0x53420 이 그 틀 갱신보다 먼저 먹인다. 웹의 수비 판은 그림(갱신 계수,
 * requestAnimationFrame)마다 그 장면 틱까지 진행기를 돌린다 — 그리기가 밀리면(느린 기기 · 30Hz 절전) 지금 틱은 앞서도 진행기와 화면은 앞
 * 그림에 서 있다. 손잡이 때의 지금 틱으로 받으면 따라잡는 갱신이 그 틱을 지난 뒤에야 먹여 송구가 한 틱 늦다. 본 그림의 틱으로 받으면
 * 따라잡는 첫 갱신이 먹인다 — 그림이 제때 섰을 때와 같은 틱에 던진다.
 */
let frames = new Map<number, FrameRequestCallback>()
let nextHandle = 1
let clock = 0
beforeEach(() => {
  frames = new Map()
  clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const handle = nextHandle
    nextHandle += 1
    frames.set(handle, callback)
    return handle
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => void frames.delete(handle))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return new Proxy({ canvas: this } as object, {
      get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : () => undefined),
      set: () => true,
    }) as never
  })
  resetCommonWindowShownForTest()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const 한틱 = millisecondsPerFrame()
/** 그림 하나 — 실제 시각 `at` 의 requestAnimationFrame */
const 그림 = (at: number) =>
  act(() => {
    clock = at
    const pending = [...frames.values()]
    frames = new Map()
    for (const callback of pending) callback(at)
  })
/** 틱 `k` 머리 조금 뒤의 시각 */
const 틱때 = (k: number) => k * 한틱 + 0.37
const 키 = (key: string) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key })))

/**
 * 판을 세우고 틱마다 그림을 그리다, 틱 `pressAt` 그림을 본 뒤 키를 누른다. `lag` 이면 그 뒤 그림이 1.6 틱 동안 안 온다(그리기 밀림) —
 * 그 사이에 누른다. 끝날 때까지 그려 결과를 돌려준다
 */
function 눌러보기(element: (onDone: (result?: DefensePlayResult) => void) => React.ReactElement, key: string, pressAt: number, lag: boolean) {
  clock = 0
  resetCommonWindowShownForTest()
  const onDone = vi.fn()
  render(element(onDone))
  let k = 1
  for (; k <= pressAt; k += 1) 그림(틱때(k))
  if (lag) {
    clock = 틱때(pressAt) + 한틱 * 1.6
    키(key)
    // 밀렸던 그림이 온다 — 따라잡는다
    k = pressAt + 2
  } else {
    키(key)
  }
  for (; k < 600 && onDone.mock.calls.length === 0; k += 1) 그림(틱때(k))
  const [result] = onDone.mock.calls[0] as [DefensePlayResult | undefined]
  cleanup()
  if (result === undefined) throw new Error('판이 안 끝났다')
  return result
}
const 송구줄 = (result: DefensePlayResult) => result.log.find((line) => line.includes('송구 지시'))

describe('수비 송구 키 — 그리기가 밀려도 본 그림의 틱으로 받는다 (r217)', () => {
  const 단타: AtBatOutcome = { kind: '안타', bases: 1 }
  const 주자1루: BaseState = { first: true, second: false, third: false }
  const 타구 = (): DefensePlayInput => ({
    outcome: 단타,
    trajectory: battedBallTrajectory(representativePatternOf(단타)),
    bases: 주자1루,
    outs: 0,
  })
  const 판 = (onDone: (result?: DefensePlayResult) => void) => <DefensePlayback input={타구()} side="수비" onDone={onDone} />

  it('타구 판 — 그림이 밀린 사이 누른 송구는 제때 그린 판과 같은 틱에 던진다', () => {
    const 제때 = 송구줄(눌러보기(판, '2', 12, false))
    expect(제때).toBeDefined()
    expect(송구줄(눌러보기(판, '2', 12, true))).toBe(제때)
  })
})

describe('주자 판 송구 키 — 그리기가 밀려도 본 그림의 틱으로 받는다 (r217)', () => {
  /** 1루 주자가 도루를 건 볼 — 공 도착 판(종류 5) */
  const 도루판 = () => {
    const opened = openPitchArrivalPlay(
      {
        batterHand: 0,
        gameMode: 2,
        pitchJudgement: 2,
        stealingFrom: [1],
        bases: { first: true, second: false, third: false },
        outs: 0,
        defenseIsCpu: false,
        offenseIsCpu: true,
      },
      createSeededRandom(3),
    )
    if (opened === null || opened.kind === 2) throw new Error('도루 판이 안 열렸다')
    return { kind: 'arrival' as const, opened }
  }
  const 판 = (onDone: (result?: DefensePlayResult) => void) => <DefensePlayback runnerPlay={도루판()} onDone={onDone} />

  it('도루 판 — 그림이 밀린 사이 누른 송구는 제때 그린 판과 같은 틱에 던진다', () => {
    const 제때 = 송구줄(눌러보기(판, '2', 3, false))
    expect(제때).toBeDefined()
    expect(송구줄(눌러보기(판, '2', 3, true))).toBe(제때)
  })
})
