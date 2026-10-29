// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BURST_RESULT_STATE_TICK, useRecordAlert } from '@/widgets/game-scene/model/useRecordAlert'
import { RecordAchievedContext } from '@/widgets/game-scene/model/recordAchievedContext'
import type { RecordAlertOptions } from '@/widgets/game-scene/model/useRecordAlert'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { markSceneStateEntries, resetSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  resetSceneStateEntries()
  vi.useRealTimers()
})

const tick = (count = 1) =>
  act(() => {
    vi.advanceTimersByTime(millisecondsPerFrame() * count)
  })

interface Props {
  readonly ids: readonly number[]
  readonly options: RecordAlertOptions
}

const rowsOf = (frame: ReturnType<typeof useRecordAlert>) => frame.rows.map((row) => row.slot)

describe('useRecordAlert — 칸 채우기 0x4e600 은 공 끝에만', () => {
  it('공 끝 번호가 안 바뀌면 줄에만 있다가 다음 공 끝에 칸에 든다 (자동진행 0x21 몫)', () => {
    const { result, rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [], options: { isDrawing: true, pitchEnd: { serial: 0 } } } as Props,
    })
    rerender({ ids: [1], options: { isDrawing: true, pitchEnd: { serial: 0 } } })
    tick()
    expect(result.current.panel).toBeNull()
    rerender({ ids: [1], options: { isDrawing: true, pitchEnd: { serial: 1 } } })
    tick()
    expect(rowsOf(result.current)).toEqual([0])
  })

  it('공 끝 그림의 새 기록 가운데 앞쪽 몫만 넣고 뒤쪽(그 뒤 자동 타석)은 다음 공 끝까지 둔다', () => {
    const humanCountOf = (added: readonly number[]) => added.filter((id) => id >= 16).length
    const { result, rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [], options: { isDrawing: true, pitchEnd: { serial: 0, humanCountOf } } } as Props,
    })
    rerender({ ids: [16, 1], options: { isDrawing: true, pitchEnd: { serial: 1, humanCountOf } } })
    tick()
    expect(result.current.rows.map((row) => row.text)).toHaveLength(1)
    rerender({ ids: [16, 1], options: { isDrawing: true, pitchEnd: { serial: 2, humanCountOf } } })
    tick()
    expect(rowsOf(result.current)).toEqual([0, 1])
  })

  it('정산 여부는 그 공 앞 상태 — 마지막 공 몫은 뜨고, 경기가 끝난 뒤 공 끝은 줄을 둔다', () => {
    const { result, rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [], options: { isDrawing: true, isSettled: false, pitchEnd: { serial: 0 } } } as Props,
    })
    rerender({ ids: [16], options: { isDrawing: true, isSettled: true, pitchEnd: { serial: 1 } } })
    tick()
    expect(rowsOf(result.current)).toEqual([0])
    rerender({ ids: [16, 28], options: { isDrawing: true, isSettled: true, pitchEnd: { serial: 2 } } })
    tick()
    expect(rowsOf(result.current)).toEqual([0])
  })

  it('처음 붙을 때의 기록은 `queuesInitialRecords` 면 줄에 넣어 첫 공 끝에 띄운다', () => {
    const { result, rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [1], options: { isDrawing: true, pitchEnd: { serial: 0 }, queuesInitialRecords: true } } as Props,
    })
    tick()
    expect(result.current.panel).toBeNull()
    rerender({ ids: [1], options: { isDrawing: true, pitchEnd: { serial: 1 }, queuesInitialRecords: true } })
    tick()
    expect(rowsOf(result.current)).toEqual([0])
  })

  it('노랑 줄 틱 [+0x2c] — 장면 상태가 바뀐 첫 그림이 0, 팝업 동안은 그대로', () => {
    const options = (key: string, isFrozen = false): RecordAlertOptions => ({
      isDrawing: true,
      isFrozen,
      sceneStateKey: key,
      pitchEnd: { serial: 1 },
    })
    const { result, rerender } = renderHook(({ ids, options: current }: Props) => useRecordAlert(ids, current), {
      initialProps: { ids: [], options: { isDrawing: true, sceneStateKey: 'a', pitchEnd: { serial: 0 } } } as Props,
    })
    rerender({ ids: [1, 2], options: options('a') })
    // 틱 1..5 → (틱 % 18) / 6 = 0, 틱 6 → 1
    tick(6)
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([false, true])
    rerender({ ids: [1, 2], options: options('b') })
    tick()
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([true, false])
    rerender({ ids: [1, 2], options: options('b', true) })
    tick(10)
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([true, false])
  })

  it('갈래 안의 원본 상태 경계 — 부품이 적은 장면 틱(예약 다음 틀)이 0 이다 (`sceneStateEntries`)', () => {
    const options: RecordAlertOptions = { isDrawing: true, sceneStateKey: 'play', pitchEnd: { serial: 1 } }
    const { result, rerender } = renderHook(({ ids, options: current }: Props) => useRecordAlert(ids, current), {
      initialProps: { ids: [], options: { isDrawing: true, sceneStateKey: 'play', pitchEnd: { serial: 0 } } } as Props,
    })
    rerender({ ids: [1, 2], options })
    // 0x12 가 지금 + 3 틱에 선다(앞 틀이 예약) — 그 틱이 상태 틱 0
    const entry = gameSceneTickNow() + 3
    markSceneStateEntries({ tick: entry, state: 0x12 })
    tick(8)
    // 상태 틱 = 8 − 3 = 5 → (5 % 18) / 6 = 0
    expect(gameSceneTickNow() - entry).toBe(5)
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([true, false])
    tick()
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([false, true])
  })
})

describe('useRecordAlert — 돌발 결과 창 0x1d 의 상태 틱 박기 (0x4d1e0 4d1e2)', () => {
  it('창이 서 있는 동안 노랑 줄은 (100 % 18) / 6 = 1 에 박히고, 걷히면 다시 센다', () => {
    const pin: { current: number | null } = { current: null }
    const options: RecordAlertOptions = { isDrawing: true, sceneStateKey: 'a', pitchEnd: { serial: 1 }, pinnedStateTickRef: pin }
    const { result, rerender } = renderHook(({ ids, options: current }: Props) => useRecordAlert(ids, current), {
      initialProps: { ids: [], options: { ...options, pitchEnd: { serial: 0 } } } as Props,
    })
    rerender({ ids: [1, 2, 3], options })
    tick(2)
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([true, false, false])
    pin.current = BURST_RESULT_STATE_TICK
    for (let step = 0; step < 20; step += 1) {
      tick()
      expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([false, true, false])
    }
    pin.current = null
    rerender({ ids: [1, 2, 3], options: { ...options, sceneStateKey: 'b' } })
    tick()
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([true, false, false])
  })
})

describe('useRecordAlert — 0xa77f0 끝 0x62234 (RecordAchievedContext)', () => {
  it('새로 든 기록마다 차례대로 한 번 — 공 끝과 상관없이 들어온 그 그림에', () => {
    const achieved: number[] = []
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <RecordAchievedContext.Provider value={(id) => achieved.push(id)}>{children}</RecordAchievedContext.Provider>
    )
    const { rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [], options: { isDrawing: true, pitchEnd: { serial: 0 } } } as Props,
      wrapper,
    })
    rerender({ ids: [15, 1], options: { isDrawing: true, pitchEnd: { serial: 0 } } })
    expect(achieved).toEqual([15, 1])
    rerender({ ids: [15, 1], options: { isDrawing: true, pitchEnd: { serial: 1 } } })
    expect(achieved).toEqual([15, 1])
    rerender({ ids: [15, 1, 31], options: { isDrawing: false, pitchEnd: { serial: 1 } } })
    expect(achieved).toEqual([15, 1, 31])
  })
})
